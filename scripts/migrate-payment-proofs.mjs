// One-off migration: moves legacy ImageKit payment screenshots (registrations.payment_screenshot_url) into the
// private Supabase Storage bucket `payment-proofs`, then removes the ImageKit copies and references.
//
//   node --env-file=.env scripts/migrate-payment-proofs.mjs plan                      read-only report (default)
//   node --env-file=.env scripts/migrate-payment-proofs.mjs copy                      copy + verify into Supabase,
//                                                                                     set payment_proof_path
//   node --env-file=.env scripts/migrate-payment-proofs.mjs verify                    re-compare both copies
//   node --env-file=.env scripts/migrate-payment-proofs.mjs cleanup                   dry run: what would be removed
//   node --env-file=.env scripts/migrate-payment-proofs.mjs cleanup --confirm-delete  clear the URL + delete the
//                                                                                     ImageKit file, per row, only
//                                                                                     after re-verifying it
//   add --delete-orphans (with --confirm-delete) to also delete unreferenced files in /innovision/payments.
//
// Safety rules:
//   * Nothing is ever deleted from ImageKit unless the Supabase copy was downloaded again in the SAME run and is
//     byte-identical (SHA-256) to the ImageKit original.
//   * The ImageKit original is fetched with `orig-true` (ImageKit otherwise serves a re-encoded copy).
//   * Ownership: a file is only copied into a user's folder when its ImageKit tag (uid_<user id>) or name prefix
//     (payment_<user id>_) matches the registration's user. Anything else is left for manual review.
//   * Writes are conditional (`payment_proof_path IS NULL`, `payment_screenshot_url = <old url>`), so re-running any
//     phase is safe.
// Requires supabase/schema.sql to have been applied (payment_proof_path column + private bucket).
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const BUCKET = 'payment-proofs';
export const PAYMENTS_FOLDER = '/innovision/payments';
export const MAX_BYTES = 1024 * 1024; // payment-proofs bucket file_size_limit
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PROOF_PATH_RE = /^([0-9a-f-]{36})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|heic)$/;

/** Image type by magic bytes (same rules as detectFileType in src/lib/security.ts, images only). */
export function detectImage(bytes) {
  const ascii = (a, b) => String.fromCharCode(...bytes.subarray(a, b));
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return { ext: 'gif', mime: 'image/gif' };
  if (ascii(4, 8) === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(ascii(8, 12))) {
    return { ext: 'heic', mime: 'image/heic' };
  }
  return null;
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** ImageKit file path ("/innovision/payments/x.png") for a stored URL, or null if it isn't one of our proofs. */
export function legacyFilePath(url, urlEndpoint) {
  let u;
  let base;
  try {
    u = new URL(url);
    base = new URL(urlEndpoint);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.origin !== base.origin || u.search || u.username || u.password) return null;
  const prefix = base.pathname.replace(/\/+$/, '');
  if (!u.pathname.startsWith(`${prefix}${PAYMENTS_FOLDER}/`)) return null;
  const filePath = u.pathname.slice(prefix.length);
  const name = filePath.slice(PAYMENTS_FOLDER.length + 1);
  if (!name || name.includes('/') || /%2e|%2f|%5c/i.test(name) || name.includes('..') || name.startsWith('tr:')) return null;
  return filePath;
}

/**
 * @param deps.db       { listLegacyRows(), setProofPath(id, path), clearLegacyUrl(id, url, path) }
 * @param deps.storage  { isPrivateBucket(), upload(path, bytes, mime), download(path), remove(path) }
 * @param deps.imagekit { listPaymentFiles(), downloadOriginal(file), deleteFile(fileId), deleteFolderIfEmpty(path) }
 */
export function createMigration({ db, storage, imagekit, urlEndpoint, newId = randomUUID }) {
  let filesCache = null;
  const paymentFiles = async () => (filesCache ??= await imagekit.listPaymentFiles());

  /** Checks one registration against the ImageKit file it references. */
  async function assess(row) {
    const filePath = legacyFilePath(row.payment_screenshot_url, urlEndpoint);
    if (!filePath) return { ok: false, reason: 'URL is not an ImageKit payment proof of this account' };
    if (!UUID_RE.test(row.user_id || '')) return { ok: false, reason: 'registration has no valid user_id' };
    const file = (await paymentFiles()).find((f) => f.filePath === filePath);
    if (!file) return { ok: false, filePath, reason: 'file not found in ImageKit' };
    const name = filePath.split('/').pop();
    const owned = (file.tags || []).includes(`uid_${row.user_id}`) || name.startsWith(`payment_${row.user_id}_`);
    if (!owned) return { ok: false, filePath, reason: 'ownership not provable (no matching uid tag / name prefix): manual review' };
    if (!(file.size > 0 && file.size <= MAX_BYTES)) return { ok: false, filePath, reason: `unexpected size ${file.size}` };
    return { ok: true, filePath, file };
  }

  async function fetchOriginal(file) {
    const bytes = await imagekit.downloadOriginal(file);
    if (bytes.length !== file.size) throw new Error(`ImageKit original is ${bytes.length} bytes, expected ${file.size}`);
    const type = detectImage(bytes);
    if (!type) throw new Error('ImageKit original is not a supported image');
    return { bytes, type };
  }

  /** Re-downloads both copies and compares them byte for byte. */
  async function compare(row, file) {
    const m = PROOF_PATH_RE.exec(row.payment_proof_path || '');
    if (!m || m[1] !== row.user_id) return { ok: false, reason: 'payment_proof_path is not in the owner\'s folder' };
    const { bytes } = await fetchOriginal(file);
    const copy = await storage.download(row.payment_proof_path);
    if (!copy) return { ok: false, reason: 'Supabase copy missing' };
    const same = copy.length === bytes.length && sha256(copy) === sha256(bytes);
    return same ? { ok: true, sha256: sha256(bytes), bytes: bytes.length } : { ok: false, reason: 'Supabase copy differs from the original' };
  }

  async function requirePrivateBucket() {
    if (!(await storage.isPrivateBucket())) throw new Error(`Bucket "${BUCKET}" is missing or not private: apply supabase/schema.sql first`);
  }

  async function plan() {
    const rows = await db.listLegacyRows();
    const files = await paymentFiles();
    const referenced = new Set(rows.map((r) => legacyFilePath(r.payment_screenshot_url, urlEndpoint)).filter(Boolean));
    const report = { legacyRows: rows.length, migratable: 0, alreadyCopied: 0, blocked: [], imagekitFiles: files.length,
      orphanFiles: files.filter((f) => !referenced.has(f.filePath)).map((f) => f.filePath) };
    for (const row of rows) {
      const a = await assess(row);
      if (!a.ok) report.blocked.push({ registration: row.id, status: row.status, reason: a.reason });
      else if (row.payment_proof_path) report.alreadyCopied++;
      else report.migratable++;
    }
    return report;
  }

  async function copy() {
    await requirePrivateBucket();
    const results = [];
    for (const row of await db.listLegacyRows()) {
      if (row.payment_proof_path) {
        results.push({ registration: row.id, result: 'skipped', reason: 'already copied' });
        continue;
      }
      const a = await assess(row);
      if (!a.ok) {
        results.push({ registration: row.id, result: 'blocked', reason: a.reason });
        continue;
      }
      let path = null;
      try {
        const { bytes, type } = await fetchOriginal(a.file);
        path = `${row.user_id}/${newId()}.${type.ext}`;
        await storage.upload(path, bytes, type.mime);
        const back = await storage.download(path);
        if (!back || back.length !== bytes.length || sha256(back) !== sha256(bytes)) {
          throw new Error('uploaded copy does not match the original');
        }
        if (!(await db.setProofPath(row.id, path))) throw new Error('registration changed concurrently (payment_proof_path already set)');
        results.push({ registration: row.id, result: 'copied', imagekitFile: a.filePath, imagekitFileId: a.file.fileId,
          storagePath: path, bytes: bytes.length, sha256: sha256(bytes) });
      } catch (err) {
        // Roll back only our own new object; the ImageKit original is never touched in this phase.
        if (path) await storage.remove(path).catch(() => {});
        results.push({ registration: row.id, result: 'failed', reason: err instanceof Error ? err.message : String(err) });
      }
    }
    return results;
  }

  async function verify() {
    const results = [];
    for (const row of await db.listLegacyRows()) {
      if (!row.payment_proof_path) {
        results.push({ registration: row.id, result: 'not copied yet' });
        continue;
      }
      const a = await assess(row);
      if (!a.ok) {
        results.push({ registration: row.id, result: 'blocked', reason: a.reason });
        continue;
      }
      try {
        const c = await compare(row, a.file);
        results.push({ registration: row.id, result: c.ok ? 'verified' : 'MISMATCH', ...c });
      } catch (err) {
        results.push({ registration: row.id, result: 'failed', reason: err instanceof Error ? err.message : String(err) });
      }
    }
    return results;
  }

  async function cleanup({ confirmDelete = false, deleteOrphans = false } = {}) {
    await requirePrivateBucket();
    const rows = await db.listLegacyRows();
    const refCount = new Map();
    for (const r of rows) {
      const fp = legacyFilePath(r.payment_screenshot_url, urlEndpoint);
      if (fp) refCount.set(fp, (refCount.get(fp) || 0) + 1);
    }
    const results = [];
    for (const row of rows) {
      if (!row.payment_proof_path) {
        results.push({ registration: row.id, result: 'kept', reason: 'not copied yet' });
        continue;
      }
      const a = await assess(row);
      if (!a.ok) {
        results.push({ registration: row.id, result: 'kept', reason: a.reason });
        continue;
      }
      try {
        const c = await compare(row, a.file); // fresh verification in this run, right before deleting
        if (!c.ok) {
          results.push({ registration: row.id, result: 'kept', reason: c.reason });
          continue;
        }
        if (!confirmDelete) {
          results.push({ registration: row.id, result: 'would clear URL and delete ImageKit file', imagekitFile: a.filePath });
          continue;
        }
        // Reference first: once cleared, nothing in the database points at ImageKit, even if the delete fails.
        if (!(await db.clearLegacyUrl(row.id, row.payment_screenshot_url, row.payment_proof_path))) {
          results.push({ registration: row.id, result: 'kept', reason: 'registration changed concurrently' });
          continue;
        }
        refCount.set(a.filePath, refCount.get(a.filePath) - 1);
        if (refCount.get(a.filePath) > 0) {
          results.push({ registration: row.id, result: 'URL cleared; file kept (still referenced elsewhere)' });
          continue;
        }
        await imagekit.deleteFile(a.file.fileId);
        filesCache = (await paymentFiles()).filter((f) => f.fileId !== a.file.fileId);
        results.push({ registration: row.id, result: 'migrated', deletedImagekitFile: a.filePath, storagePath: row.payment_proof_path });
      } catch (err) {
        results.push({ registration: row.id, result: 'failed', reason: err instanceof Error ? err.message : String(err) });
      }
    }

    const stillReferenced = new Set([...refCount].filter(([, n]) => n > 0).map(([fp]) => fp));
    const orphans = (await paymentFiles()).filter((f) => !stillReferenced.has(f.filePath));
    const orphanReport = [];
    for (const f of orphans) {
      if (confirmDelete && deleteOrphans) {
        await imagekit.deleteFile(f.fileId);
        orphanReport.push({ file: f.filePath, result: 'deleted (unreferenced)' });
      } else {
        orphanReport.push({ file: f.filePath, result: 'unreferenced; kept (use --confirm-delete --delete-orphans)' });
      }
    }
    if (confirmDelete && deleteOrphans) filesCache = [];
    let folderRemoved = false;
    if (confirmDelete && (await paymentFiles()).length === 0) folderRemoved = await imagekit.deleteFolderIfEmpty(PAYMENTS_FOLDER);
    return { registrations: results, orphans: orphanReport, paymentsFolderRemoved: folderRemoved };
  }

  return { plan, copy, verify, cleanup };
}

/* ------------------------------------------------ real adapters ------------------------------------------------ */

async function realDeps(env) {
  const { createClient } = await import('@supabase/supabase-js');
  const { default: ImageKit } = await import('imagekit');
  for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'IMAGEKIT_URL_ENDPOINT', 'IMAGEKIT_PUBLIC_KEY', 'IMAGEKIT_PRIVATE_KEY']) {
    if (!env[k]) throw new Error(`${k} is not set (run with node --env-file=.env)`);
  }
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = sb.storage.from(BUCKET);
  const ik = new ImageKit({ publicKey: env.IMAGEKIT_PUBLIC_KEY, privateKey: env.IMAGEKIT_PRIVATE_KEY, urlEndpoint: env.IMAGEKIT_URL_ENDPOINT });

  const db = {
    async listLegacyRows() {
      const query = (cols) =>
        sb.from('registrations').select(cols).not('payment_screenshot_url', 'is', null).neq('payment_screenshot_url', '');
      const { data, error } = await query('id, user_id, status, payment_screenshot_url, payment_proof_path');
      if (!error) return data;
      // Before supabase/schema.sql is applied there is no payment_proof_path column: still allow the read-only plan.
      const legacy = await query('id, user_id, status, payment_screenshot_url');
      if (legacy.error) throw new Error(`listing registrations failed: ${legacy.error.message}`);
      return legacy.data.map((r) => ({ ...r, payment_proof_path: null }));
    },
    async setProofPath(id, path) {
      const { data, error } = await sb.from('registrations').update({ payment_proof_path: path })
        .eq('id', id).is('payment_proof_path', null).select('id');
      if (error) throw new Error(error.message);
      return data.length === 1;
    },
    async clearLegacyUrl(id, url, path) {
      const { data, error } = await sb.from('registrations').update({ payment_screenshot_url: null })
        .eq('id', id).eq('payment_screenshot_url', url).eq('payment_proof_path', path).select('id');
      if (error) throw new Error(error.message);
      return data.length === 1;
    },
  };

  const storage = {
    async isPrivateBucket() {
      const { data, error } = await sb.storage.getBucket(BUCKET);
      return !error && data?.public === false;
    },
    async upload(path, bytes, mime) {
      const { error } = await bucket.upload(path, bytes, { contentType: mime, upsert: false });
      if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    },
    async download(path) {
      const { data, error } = await bucket.download(path);
      return error || !data ? null : Buffer.from(await data.arrayBuffer());
    },
    async remove(path) {
      await bucket.remove([path]);
    },
  };

  const imagekit = {
    async listPaymentFiles() {
      const files = [];
      for (let skip = 0; ; skip += 1000) {
        const page = await ik.listFiles({ path: PAYMENTS_FOLDER, skip, limit: 1000 });
        files.push(...page.filter((f) => f.type !== 'folder' && f.filePath.startsWith(`${PAYMENTS_FOLDER}/`)));
        if (page.length < 1000) break;
      }
      return files;
    },
    async downloadOriginal(file) {
      // Private file: short-lived signed URL; orig-true returns the stored bytes instead of an optimized copy.
      const url = ik.url({ src: file.url, signed: true, expireSeconds: 120, transformation: [{ raw: 'orig-true' }] });
      const res = await fetch(url);
      if (!res.ok) throw new Error(`ImageKit download failed: HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
    async deleteFile(fileId) {
      const details = await ik.getFileDetails(fileId);
      if (!details.filePath.startsWith(`${PAYMENTS_FOLDER}/`)) throw new Error(`refusing to delete ${details.filePath}: outside ${PAYMENTS_FOLDER}`);
      await ik.deleteFile(fileId);
    },
    async deleteFolderIfEmpty(path) {
      const left = await ik.listFiles({ path, limit: 1, includeFolder: true });
      if (left.length > 0) return false;
      await ik.deleteFolder(path);
      return true;
    },
  };

  return { db, storage, imagekit, urlEndpoint: env.IMAGEKIT_URL_ENDPOINT };
}

async function main(argv) {
  const [phase = 'plan', ...flags] = argv;
  if (!['plan', 'copy', 'verify', 'cleanup'].includes(phase)) throw new Error(`unknown phase "${phase}"`);
  const confirmDelete = flags.includes('--confirm-delete');
  const deleteOrphans = flags.includes('--delete-orphans');
  if (deleteOrphans && !confirmDelete) throw new Error('--delete-orphans requires --confirm-delete');
  const m = createMigration(await realDeps(process.env));
  const out = phase === 'cleanup' ? await m.cleanup({ confirmDelete, deleteOrphans }) : await m[phase]();
  console.log(JSON.stringify({ phase, confirmDelete, at: new Date().toISOString(), result: out }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
