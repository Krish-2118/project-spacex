// One-off import step 1: turns the "Final Events" tab of `final sheet events.xlsx` into rows ready for public.events.
// Each poster is downloaded from Google Drive, converted to WebP below 1,000,000 bytes and uploaded to ImageKit
// (/innovision/events); the Drive poster link is replaced by the ImageKit URL.
//
//   node --env-file=.env scripts/process-event-posters.mjs --dry-run   download, validate and convert only: writes
//                                                                      previews + reports, no ImageKit upload
//   node --env-file=.env scripts/process-event-posters.mjs             also upload to ImageKit and write
//                                                                      output/events-ready-to-import.csv
//   options: --input <file.xlsx>  --out <dir>
//            --overrides <file.json>  per-title decisions (see event-import-overrides.json):
//                                     { "exclude": { "<title>": "<reason>" }, "posterFiles": { "<title>": "<path>" },
//                                       "descriptionFixes": { "<title>": [["<from>", "<to>"], ...] } }
//                                     paths are relative to the overrides file; titles must match a sheet row;
//                                     every description fix must match, or the row fails
//            --refresh                ignore earlier results and process every row again
//            --no-upload              rebuild the CSV from earlier uploads only: a row whose poster is not already
//                                     in ImageKit fails instead of being processed and uploaded
//
// Resume: a row that was `ready` in the previous upload report (output/events-processing-report.json) is kept as is,
// without downloading or uploading again, when its poster source (Drive file id, or SHA-256 of the local file) is
// unchanged and the ImageKit file still exists. Only new or changed posters are processed.
//
// Outputs (in --out, default ./output):
//   events-ready-to-import.csv     title, description, poster_url, brochure_url, category (not written by --dry-run)
//   events-processing-report.json  every source row with its status: nothing is dropped silently
//   events-failed.csv              rows that could not be processed, with the reason
//   previews/                      the converted WebP posters, for checking before upload
//
// Rules:
//   * Only the "Final Events" sheet is imported; "Needs Review" rows are reported as skipped.
//   * Exact duplicate names (trimmed, case-insensitive): the latest row wins, earlier ones are reported as skipped.
//   * Drive files are fetched anonymously: a file that is not shared "Anyone with the link" comes back as an HTML
//     page and the row fails. Permissions are never bypassed.
//   * ImageKit names are `event_<slug>_<sha256 of the WebP, 12 hex>.webp`, so a rerun with the same poster finds the
//     earlier upload and reuses it instead of uploading again. Existing files are never overwritten.
//   * No database writes happen here: see scripts/build-events-import-sql.mjs for step 2.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const IMPORT_SHEET = 'Final Events';
export const REVIEW_SHEET = 'Needs Review';
export const EVENTS_FOLDER = '/innovision/events';
export const MAX_WEBP_BYTES = 1_000_000; // strictly below; the admin API allows 1 MiB
export const CSV_COLUMNS = ['title', 'description', 'poster_url', 'brochure_url', 'category'];
export const TEXT_LIMITS = { title: 200, description: 5000, brochure_url: 2048 }; // as in /api/admin/events

const CATEGORY_MAP = { flagship: 'flagship events', standout: 'standout events', main: 'main events' };
const HEADERS = { title: 'event name', description: 'description', poster: 'poster link', rulebook: 'rulebook link', type: 'event type' };
const MAX_DOWNLOAD_BYTES = 40 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60_000;
// Longest-edge caps, tried in order; every cap tries all qualities before the next one shrinks the poster.
// 1080px is the floor so poster text stays readable: below that the row fails instead.
const LONG_EDGES = [2560, 2048, 1800, 1600, 1440, 1280, 1080];
const QUALITIES = [86, 80, 74, 68, 62];
// Same rule as the events_brochure_url_check constraint in supabase/schema.sql.
const BROCHURE_RE = /^https?:\/\/([a-z0-9-]+\.)*(drive|docs)\.google\.com\/.+/i;
const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,}$/;

/* ------------------------------------------------ pure helpers ------------------------------------------------ */

export const normalizeTitle = (title) => String(title ?? '').trim().toLowerCase();

const cellText = (v) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v));

/** First http(s) URL in a cell (cells may hold several links separated by spaces, commas or new lines). */
export function firstUrl(cell) {
  const urls = cellText(cell).split(/[\s,;]+/).filter((s) => /^https?:\/\//i.test(s));
  return { url: urls[0] || '', count: urls.length };
}

/** Google Drive file id from `drive.google.com/open?id=…`, `/file/d/<id>/view`, `/uc?id=…` links, or null. */
export function driveFileId(link) {
  let u;
  try {
    u = new URL(link);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.hostname.toLowerCase() !== 'drive.google.com') return null;
  const m = /^\/file\/(?:u\/\d+\/)?d\/([^/]+)/.exec(u.pathname);
  const id = m ? m[1] : ['/open', '/uc'].includes(u.pathname) ? u.searchParams.get('id') : null;
  return id && DRIVE_ID_RE.test(id) ? id : null;
}

export function mapCategory(raw) {
  const key = cellText(raw).trim().toLowerCase();
  return Object.hasOwn(CATEGORY_MAP, key) ? CATEGORY_MAP[key] : null;
}

export function slugify(title) {
  const s = String(title).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  return s || 'event';
}

/** Image type by magic bytes (images only; HTML and PDF are recognised so the error says what Drive returned). */
export function sniff(bytes) {
  const ascii = (a, b) => String.fromCharCode(...bytes.subarray(a, b));
  if (bytes.length < 12) return { kind: 'unknown' };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { kind: 'image', format: 'jpeg' };
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: 'image', format: 'png' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { kind: 'image', format: 'webp' };
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return { kind: 'image', format: 'gif' };
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (['avif', 'avis'].includes(brand)) return { kind: 'image', format: 'avif' };
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return { kind: 'image', format: 'heic' };
  }
  if (ascii(0, 4) === 'II*\0' || ascii(0, 4) === 'MM\0*') return { kind: 'image', format: 'tiff' };
  if (ascii(0, 5) === '%PDF-') return { kind: 'pdf' };
  const head = bytes.subarray(0, 1024).toString('utf8').trimStart().toLowerCase();
  if (head.includes('<svg')) return { kind: 'svg' };
  if (head.startsWith('<')) return { kind: 'html' };
  return { kind: 'unknown' };
}

const csvField = (v) => `"${cellText(v).replace(/"/g, '""')}"`;

/** RFC 4180 CSV (every field quoted, CRLF line ends). */
export function toCsv(columns, rows) {
  return [columns.map(csvField).join(','), ...rows.map((r) => columns.map((c) => csvField(r[c])).join(','))].join('\r\n') + '\r\n';
}

/** Parses RFC 4180 CSV into objects keyed by the header row. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (quoted) throw new Error('CSV ends inside a quoted field');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  if (!header) return { header: [], records: [] };
  return { header, records: body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))) };
}

/** Sheet rows → source records keyed by the header names (columns are found by header, not position). */
export function readSheetRows(sheetName, data) {
  const [head = [], ...rest] = data;
  const names = head.map((h) => cellText(h).trim().toLowerCase());
  const col = {};
  for (const [key, header] of Object.entries(HEADERS)) {
    col[key] = names.indexOf(header);
    if (col[key] === -1) throw new Error(`Sheet "${sheetName}" has no "${header}" column (found: ${names.join(', ')})`);
  }
  return rest.map((cells, i) => ({
    sheet: sheetName,
    row: i + 2, // spreadsheet row number: data[0] is the header on row 1
    title: cellText(cells[col.title]).trim(),
    description: cellText(cells[col.description]).trim(),
    posterCell: cellText(cells[col.poster]).trim(),
    rulebookCell: cellText(cells[col.rulebook]).trim(),
    type: cellText(cells[col.type]).trim(),
  }));
}

/**
 * Validates one source row and plans its processing. Returns the event fields or a failure reason.
 * Does no I/O.
 */
export function planRow(src, { posterFile = null } = {}) {
  const warnings = [];
  if (!src.title && !src.description && !src.posterCell && !src.rulebookCell && !src.type) {
    return { status: 'skipped_blank', reason: 'empty row' };
  }
  const fail = (reason) => ({ status: 'failed', reason, warnings });
  if (!src.title) return fail('missing event name');
  if (src.title.length > TEXT_LIMITS.title) return fail(`event name longer than ${TEXT_LIMITS.title} characters`);
  if (!src.description) return fail('missing description');
  if (src.description.length > TEXT_LIMITS.description) return fail(`description longer than ${TEXT_LIMITS.description} characters`);

  const category = mapCategory(src.type);
  if (!category) return fail(`unknown event type "${src.type}" (expected Flagship, Standout or Main)`);
  if (!Object.keys(CATEGORY_MAP).some((k) => k[0].toUpperCase() + k.slice(1) === src.type)) {
    warnings.push(`event type "${src.type}" matched case-insensitively`);
  }

  const poster = firstUrl(src.posterCell);
  let fileId = null;
  if (posterFile) {
    warnings.push(`poster taken from local file ${basename(posterFile)} (overrides the Drive link)`);
  } else {
    if (!poster.url) return fail('missing poster link');
    if (poster.count > 1) warnings.push(`${poster.count} poster links: using the first`);
    fileId = driveFileId(poster.url);
    if (!fileId) return fail(`poster link is not a Google Drive file link: ${poster.url}`);
  }

  let brochureUrl = null;
  if (src.rulebookCell) {
    const rulebook = firstUrl(src.rulebookCell);
    if (!rulebook.url || !BROCHURE_RE.test(rulebook.url)) return fail(`rulebook link is not a Google Drive/Docs link: ${src.rulebookCell}`);
    if (rulebook.url.length > TEXT_LIMITS.brochure_url) return fail('rulebook link is too long');
    if (rulebook.count > 1) warnings.push(`${rulebook.count} rulebook links: using the first`);
    brochureUrl = rulebook.url;
  } else {
    warnings.push('no rulebook link');
  }

  return { status: 'planned', warnings, event: { title: src.title, description: src.description, brochure_url: brochureUrl, category }, posterLink: poster.url, fileId, posterFile };
}

/** Marks every earlier row whose trimmed, case-insensitive name repeats later in the sheet (the latest row wins). */
export function latestRowWins(rows) {
  const last = new Map();
  for (const r of rows) if (r.title) last.set(normalizeTitle(r.title), r.row);
  return rows.map((r) => {
    const winner = r.title ? last.get(normalizeTitle(r.title)) : r.row;
    return winner === r.row ? { src: r } : { src: r, supersededBy: winner };
  });
}

/* ------------------------------------------------ image work ------------------------------------------------ */

/** Drive download with retries for network errors, 429 and 5xx (Drive returns occasional 500s on large files). */
async function downloadDriveFile(fileId, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await downloadOnce(fileId);
    } catch (err) {
      if (!err.retryable || attempt >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

async function downloadOnce(fileId) {
  const url = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  const retryable = (message) => Object.assign(new Error(message), { retryable: true });
  let res;
  try {
    res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  } catch (err) {
    throw retryable(`download failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (res.status === 429 || res.status >= 500) throw retryable(`download failed: HTTP ${res.status} (after retries)`);
  if (!res.ok) {
    const hint = res.status === 403 || res.status === 401 ? ' (file not shared "Anyone with the link"?)' : '';
    throw new Error(`download failed: HTTP ${res.status}${hint}`);
  }
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_DOWNLOAD_BYTES) throw new Error(`file is ${declared} bytes (limit ${MAX_DOWNLOAD_BYTES})`);
  const chunks = [];
  let total = 0;
  for await (const chunk of res.body) {
    total += chunk.length;
    if (total > MAX_DOWNLOAD_BYTES) throw new Error(`file is larger than ${MAX_DOWNLOAD_BYTES} bytes`);
    chunks.push(chunk);
  }
  return { bytes: Buffer.concat(chunks), contentType: res.headers.get('content-type') || '' };
}

/** Checks the download really is an image Sharp can read. */
async function validateImage(sharp, { bytes, contentType }) {
  if (bytes.length === 0) throw new Error('Drive returned an empty file');
  const t = sniff(bytes);
  // Magic bytes decide; the content-type only matters when they don't identify an image.
  if (t.kind === 'html' || (t.kind !== 'image' && contentType.toLowerCase().startsWith('text/html'))) {
    throw new Error('Drive returned an HTML page instead of the file (not shared "Anyone with the link", sign-in required, or a download warning)');
  }
  if (t.kind === 'pdf') throw new Error('poster is a PDF, not an image: export it as PNG/JPG in Drive');
  if (t.kind === 'svg') throw new Error('poster is an SVG: export it as PNG/JPG in Drive');
  if (t.kind !== 'image') throw new Error(`downloaded file is not a supported image (content-type "${contentType}")`);
  let meta;
  try {
    meta = await sharp(bytes, { failOn: 'error' }).metadata();
  } catch (err) {
    throw new Error(`invalid or unsupported ${t.format} image: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!meta.width || !meta.height) throw new Error('image has no dimensions');
  // EXIF orientations 5-8 swap width and height once auto-oriented.
  const swap = (meta.orientation || 1) >= 5;
  return { format: t.format, width: swap ? meta.height : meta.width, height: swap ? meta.width : meta.height, pages: meta.pages || 1 };
}

/** WebP strictly below MAX_WEBP_BYTES: all qualities at one size first, then progressively smaller sizes. */
export async function encodeUnderLimit(sharp, bytes, { width, height }, limit = MAX_WEBP_BYTES) {
  const longEdge = Math.max(width, height);
  const caps = [...new Set(LONG_EDGES.map((cap) => Math.min(cap, longEdge)))];
  let attempts = 0;
  let smallest = null;
  for (const cap of caps) {
    for (const quality of QUALITIES) {
      attempts++;
      const { data, info } = await sharp(bytes, { failOn: 'error' })
        .rotate() // apply EXIF orientation
        .resize({ width: cap, height: cap, fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 6, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });
      if (!smallest || data.length < smallest) smallest = data.length;
      if (data.length < limit) return { ok: true, data, width: info.width, height: info.height, quality, attempts };
    }
  }
  return { ok: false, attempts, smallestBytes: smallest, minLongEdge: caps.at(-1) };
}

/* ------------------------------------------------ ImageKit ------------------------------------------------ */

async function imagekitClient(env) {
  for (const k of ['IMAGEKIT_URL_ENDPOINT', 'IMAGEKIT_PUBLIC_KEY', 'IMAGEKIT_PRIVATE_KEY']) {
    if (!env[k]) throw new Error(`${k} is not set (run with node --env-file=.env, or use --dry-run)`);
  }
  const { default: ImageKit } = await import('imagekit');
  const ik = new ImageKit({ publicKey: env.IMAGEKIT_PUBLIC_KEY, privateKey: env.IMAGEKIT_PRIVATE_KEY, urlEndpoint: env.IMAGEKIT_URL_ENDPOINT });
  const endpoint = env.IMAGEKIT_URL_ENDPOINT.replace(/\/+$/, '');
  let existing = null;

  /** Every file already in /innovision/events, by file path (one listing per run). */
  async function existingFiles() {
    if (existing) return existing;
    existing = new Map();
    for (let skip = 0; ; skip += 1000) {
      const page = await ik.listFiles({ path: EVENTS_FOLDER, skip, limit: 1000 });
      for (const f of page) if (f.type !== 'folder' && f.filePath?.startsWith(`${EVENTS_FOLDER}/`)) existing.set(f.filePath, f);
      if (page.length < 1000) break;
    }
    return existing;
  }

  const sansQuery = (href) => {
    // Listings add a ?updatedAt= cache-buster; drop it so a rerun writes the same URL as the first upload.
    const url = new URL(href);
    url.search = '';
    return url.href;
  };

  const checkUrl = (url) => {
    if (typeof url !== 'string' || !url.startsWith(`${endpoint}${EVENTS_FOLDER}/`) || !/^https:\/\/[^\s"'<>]+$/.test(url)) {
      throw new Error(`ImageKit returned an unexpected URL: ${url}`);
    }
    return url;
  };

  return {
    /** The earlier upload of a resumed row, if it is still in ImageKit with the same size. */
    async findPoster(filePath, bytes) {
      const found = (await existingFiles()).get(filePath);
      return found && found.size === bytes ? { fileId: found.fileId, filePath, url: checkUrl(sansQuery(found.url)) } : null;
    },

    /** Reuses an identical earlier upload, else uploads. Never overwrites a different file of the same name. */
    async putPoster(fileName, data) {
      const filePath = `${EVENTS_FOLDER}/${fileName}`;
      const found = (await existingFiles()).get(filePath);
      if (found) {
        if (found.size !== data.length) throw new Error(`ImageKit already has ${filePath} with a different size (${found.size} bytes): not overwriting`);
        return { action: 'reused', fileId: found.fileId, filePath, url: checkUrl(sansQuery(found.url)) };
      }
      const res = await ik.upload({
        file: data,
        fileName,
        folder: EVENTS_FOLDER,
        useUniqueFileName: false, // deterministic name: reruns find this file instead of uploading a copy
        overwriteFile: false,
        tags: ['innovision-event-import'],
      });
      if (res.filePath !== filePath) throw new Error(`ImageKit stored the poster at ${res.filePath}, expected ${filePath}`);
      if (res.size !== undefined && res.size !== data.length) throw new Error(`ImageKit stored ${res.size} bytes, expected ${data.length}`);
      existing.set(filePath, { fileId: res.fileId, filePath, url: res.url, size: data.length });
      return { action: 'uploaded', fileId: res.fileId, filePath, url: checkUrl(res.url) };
    },
  };
}

/* ------------------------------------------------ run ------------------------------------------------ */

/** Poster source identity: reruns keep an earlier result only while this is unchanged. */
const sourceKeyOf = (row) => row.sourceKey || (row.driveFileId ? `drive:${row.driveFileId}` : null);

/** Exact text replacements in a row's description; every replacement must match at least once. */
export function applyDescriptionFixes(src, fixes) {
  let description = src.description;
  const applied = [];
  for (const [from, to] of fixes) {
    const count = description.split(from).length - 1;
    if (!count) return { error: `description fix "${from}" -> "${to}" does not match the description` };
    description = description.split(from).join(to);
    applied.push(`description: replaced "${from}" with "${to}" (${count}x)`);
  }
  return { src: { ...src, description }, applied };
}

async function processRow(entry, { sharp, dryRun, noUpload, imagekit, previewsDir, overrides, previous }) {
  const { src } = entry;
  const key = normalizeTitle(src.title);
  const base = { sheet: src.sheet, row: src.row, title: src.title, eventType: src.type, posterLink: firstUrl(src.posterCell).url || src.posterCell };
  if (entry.supersededBy) {
    return { ...base, status: 'skipped_duplicate', reason: `same name as row ${entry.supersededBy}, which is newer and is used instead` };
  }
  if (src.title && overrides.exclude.has(key)) {
    return { ...base, status: 'skipped_excluded', reason: `excluded by overrides: ${overrides.exclude.get(key)}` };
  }
  const fixes = src.title ? overrides.descriptionFixes.get(key) : null;
  const fixed = fixes ? applyDescriptionFixes(src, fixes) : { src, applied: [] };
  if (fixed.error) return { ...base, status: 'failed', reason: fixed.error };
  const plan = planRow(fixed.src, { posterFile: src.title ? overrides.posterFiles.get(key) : null });
  if (plan.status !== 'planned') return { ...base, status: plan.status, reason: plan.reason, warnings: plan.warnings };
  plan.warnings.push(...fixed.applied);

  const result = { ...base, status: 'failed', category: plan.event.category, driveFileId: plan.fileId, brochure_url: plan.event.brochure_url, warnings: plan.warnings };
  if (plan.posterFile) result.posterFile = basename(plan.posterFile);
  try {
    const localBytes = plan.posterFile ? await readFile(plan.posterFile) : null;
    result.sourceKey = localBytes ? `file:${createHash('sha256').update(localBytes).digest('hex')}` : `drive:${plan.fileId}`;

    // Resume: same source as an earlier ready row whose upload is still in ImageKit -> keep it, nothing to redo.
    const prior = previous.get(key);
    if (prior && sourceKeyOf(prior) === result.sourceKey) {
      const kept = dryRun
        ? { url: prior.event.poster_url }
        : await imagekit.findPoster(prior.imagekit.filePath, prior.output.bytes);
      if (kept) {
        return {
          ...result,
          status: 'ready',
          source: prior.source,
          output: prior.output,
          imagekit: { ...prior.imagekit, ...kept, action: dryRun ? 'kept from previous run (not re-checked in dry run)' : 'kept from previous run' },
          event: { ...plan.event, poster_url: kept.url },
        };
      }
    }

    if (noUpload) throw new Error('poster is not in ImageKit from a previous run, and --no-upload forbids processing it again');
    const download = localBytes ? { bytes: localBytes, contentType: '' } : await downloadDriveFile(plan.fileId);
    const image = await validateImage(sharp, download);
    result.source = { bytes: download.bytes.length, format: image.format, width: image.width, height: image.height };
    if (image.pages > 1) result.warnings.push(`source has ${image.pages} frames/pages: using the first`);

    const webp = await encodeUnderLimit(sharp, download.bytes, image);
    if (!webp.ok) {
      throw new Error(`could not get the WebP below ${MAX_WEBP_BYTES} bytes without going under ${webp.minLongEdge}px (smallest: ${webp.smallestBytes} bytes)`);
    }
    const sha256 = createHash('sha256').update(webp.data).digest('hex');
    const fileName = `event_${slugify(src.title)}_${sha256.slice(0, 12)}.webp`;
    const preview = join(previewsDir, `r${src.row}_${slugify(src.title)}.webp`);
    await writeFile(preview, webp.data);
    result.output = { bytes: webp.data.length, width: webp.width, height: webp.height, quality: webp.quality, attempts: webp.attempts, sha256, preview };
    result.imagekit = { fileName, filePath: `${EVENTS_FOLDER}/${fileName}` };

    if (dryRun) {
      result.status = 'converted';
      result.reason = 'dry run: not uploaded';
      return result;
    }
    const put = await imagekit.putPoster(fileName, webp.data);
    result.imagekit = { ...result.imagekit, ...put };
    result.status = 'ready';
    result.event = { ...plan.event, poster_url: put.url };
    return result;
  } catch (err) {
    result.status = 'failed';
    result.reason = err instanceof Error ? err.message : String(err);
    return result;
  }
}

/** Reads the overrides file; every title in it must name exactly one row of the import sheet. */
export async function loadOverrides(file, rows) {
  const empty = { file: null, exclude: new Map(), posterFiles: new Map(), descriptionFixes: new Map() };
  if (!file) return empty;
  const path = resolve(file);
  const json = JSON.parse(await readFile(path, 'utf8'));
  const known = new Map();
  for (const r of rows) if (r.title) known.set(normalizeTitle(r.title), (known.get(normalizeTitle(r.title)) || 0) + 1);
  const keyOf = (title, section) => {
    const key = normalizeTitle(title);
    if (!known.has(key)) throw new Error(`${file}: ${section} title "${title}" is not in the "${IMPORT_SHEET}" sheet`);
    return key;
  };
  const out = { file, exclude: new Map(), posterFiles: new Map(), descriptionFixes: new Map() };
  for (const [title, reason] of Object.entries(json.exclude || {})) out.exclude.set(keyOf(title, 'exclude'), String(reason));
  for (const [title, pairs] of Object.entries(json.descriptionFixes || {})) {
    const valid = Array.isArray(pairs) && pairs.every((p) => Array.isArray(p) && p.length === 2 && p.every((s) => typeof s === 'string') && p[0]);
    if (!valid) throw new Error(`${file}: descriptionFixes for "${title}" must be a list of ["from", "to"] pairs`);
    out.descriptionFixes.set(keyOf(title, 'descriptionFixes'), pairs);
  }
  for (const [title, rel] of Object.entries(json.posterFiles || {})) {
    const key = keyOf(title, 'posterFiles');
    if (out.exclude.has(key)) throw new Error(`${file}: "${title}" is both excluded and given a poster file`);
    const abs = resolve(dirname(path), rel);
    if (!existsSync(abs)) throw new Error(`${file}: poster file for "${title}" not found: ${rel}`);
    out.posterFiles.set(key, abs);
  }
  return out;
}

/** Ready rows of the previous run, by normalized title (the resume source). */
async function loadPrevious(reportPath) {
  if (!existsSync(reportPath)) return new Map();
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  return new Map((report.events || [])
    .filter((e) => e.status === 'ready' && e.event?.poster_url && e.imagekit?.filePath && e.output?.bytes)
    .map((e) => [normalizeTitle(e.title), e]));
}

function parseArgs(argv) {
  const opts = { dryRun: false, noUpload: false, input: 'final sheet events.xlsx', out: 'output', overrides: null, refresh: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--refresh') opts.refresh = true;
    else if (a === '--no-upload') opts.noUpload = true;
    else if (a === '--input') opts.input = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--overrides') opts.overrides = argv[++i];
    else throw new Error(`unknown argument "${a}"`);
  }
  if (!opts.input || !opts.out) throw new Error('--input and --out need a value');
  if (argv.includes('--overrides') && !opts.overrides) throw new Error('--overrides needs a file');
  if (opts.noUpload && (opts.dryRun || opts.refresh)) throw new Error('--no-upload cannot be combined with --dry-run or --refresh');
  return opts;
}

async function main(argv) {
  const opts = parseArgs(argv);
  const input = resolve(opts.input);
  const outDir = resolve(opts.out);
  const previewsDir = join(outDir, 'previews');
  const { default: sharp } = await import('sharp');
  const { default: readXlsxFile } = await import('read-excel-file/node');
  // Fail on missing credentials before downloading anything.
  const imagekit = opts.dryRun ? null : await imagekitClient(process.env);

  const sheets = await readXlsxFile(input);
  const importSheet = sheets.find((s) => s.sheet === IMPORT_SHEET);
  if (!importSheet) throw new Error(`Workbook has no "${IMPORT_SHEET}" sheet (found: ${sheets.map((s) => s.sheet).join(', ')})`);
  const rows = readSheetRows(IMPORT_SHEET, importSheet.data);
  const overrides = await loadOverrides(opts.overrides, rows);
  const reportPath = join(outDir, 'events-processing-report.json');
  const previous = opts.refresh ? new Map() : await loadPrevious(reportPath);

  await mkdir(previewsDir, { recursive: true });
  const results = [];
  for (const entry of latestRowWins(rows)) {
    const r = await processRow(entry, { sharp, dryRun: opts.dryRun, noUpload: opts.noUpload, imagekit, previewsDir, overrides, previous });
    results.push(r);
    const detail = r.status === 'ready' ? r.imagekit.action : r.reason || '';
    console.error(`[${r.status}] row ${r.row} ${r.title || '(blank)'}${detail ? `: ${detail}` : ''}`);
  }

  // Rows of other sheets are listed too, so nothing in the workbook disappears without a trace.
  const otherSheets = sheets.filter((s) => s.sheet !== IMPORT_SHEET).map((s) => {
    const list = s.sheet === REVIEW_SHEET ? readSheetRows(s.sheet, s.data).filter((r) => r.title) : [];
    const imported = new Set(rows.map((r) => normalizeTitle(r.title)));
    return {
      sheet: s.sheet,
      status: 'skipped_sheet',
      reason: s.sheet === REVIEW_SHEET ? 'category not confirmed yet' : 'not part of the import',
      rows: list.map((r) => ({ row: r.row, title: r.title, alsoInFinalEvents: imported.has(normalizeTitle(r.title)) })),
    };
  });

  const ready = results.filter((r) => r.status === 'ready');
  const failed = results.filter((r) => r.status === 'failed');
  const count = (s) => results.filter((r) => r.status === s).length;
  const report = {
    generatedAt: new Date().toISOString(),
    mode: opts.dryRun ? 'dry-run' : opts.noUpload ? 'no-upload' : 'upload',
    input: opts.input,
    sheet: IMPORT_SHEET,
    overrides: overrides.file,
    summary: {
      sourceRows: results.length,
      ready: ready.length,
      converted: count('converted'),
      failed: failed.length,
      skippedDuplicate: count('skipped_duplicate'),
      skippedExcluded: count('skipped_excluded'),
      skippedBlank: count('skipped_blank'),
      uploaded: ready.filter((r) => r.imagekit.action === 'uploaded').length,
      reusedExistingUpload: ready.filter((r) => r.imagekit.action === 'reused').length,
      keptFromPreviousRun: ready.filter((r) => r.imagekit.action.startsWith('kept')).length,
    },
    readyCsv: opts.dryRun ? 'not written in dry-run mode' : 'events-ready-to-import.csv',
    events: results,
    otherSheets,
  };

  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  await writeFile(join(outDir, 'events-failed.csv'), toCsv(['sheet', 'row', 'title', 'event_type', 'poster_link', 'reason'],
    failed.map((r) => ({ sheet: r.sheet, row: r.row, title: r.title, event_type: r.eventType, poster_link: r.posterFile || r.posterLink, reason: r.reason }))));
  if (!opts.dryRun) {
    await writeFile(join(outDir, 'events-ready-to-import.csv'), toCsv(CSV_COLUMNS, ready.map((r) => r.event)));
  }
  console.log(JSON.stringify({ mode: report.mode, summary: report.summary, outDir }, null, 2));
  if (failed.length) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
