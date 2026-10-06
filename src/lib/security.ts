/**
 * Server-side security helpers for Innovision 2026.
 *
 * Kept free of `@/` imports and framework APIs so they can be unit tested directly with `node --test`.
 */

import { createHash } from 'node:crypto';

/* ---------------------------------------------------------------------------------------------------------------
 * Upload validation
 * ------------------------------------------------------------------------------------------------------------- */

export type DetectedFileType = 'jpeg' | 'png' | 'webp' | 'gif' | 'heic' | 'pdf';

/** Folders a registrant may upload into via /api/upload, keyed by the value the client sends. */
export const REGISTRATION_UPLOAD_FOLDERS = {
  '/innovision/payments': ['jpeg', 'png', 'webp', 'gif', 'heic'],
} as const satisfies Record<string, readonly DetectedFileType[]>;

export type RegistrationUploadFolder = keyof typeof REGISTRATION_UPLOAD_FOLDERS;

export function isRegistrationUploadFolder(folder: unknown): folder is RegistrationUploadFolder {
  return typeof folder === 'string' && Object.prototype.hasOwnProperty.call(REGISTRATION_UPLOAD_FOLDERS, folder);
}

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...Array.from(bytes.subarray(start, end)));

/**
 * Identifies a file by its magic bytes, ignoring the client-supplied name and MIME type (both are attacker controlled).
 */
export function detectFileType(bytes: Uint8Array): DetectedFileType | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'png';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return 'gif';
  if (ascii(bytes, 0, 5) === '%PDF-') return 'pdf';
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12);
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'heic';
  }
  return null;
}

export const FILE_EXTENSIONS: Record<DetectedFileType, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  heic: 'heic',
  pdf: 'pdf',
};

/* ---------------------------------------------------------------------------------------------------------------
 * URL validation
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * True when `url` is an https URL inside `folder` of the configured ImageKit endpoint, i.e. a file our own
 * /api/upload produced. Rejects `javascript:`/`data:` URLs, other hosts and path traversal.
 */
export function isImageKitUrlInFolder(url: unknown, endpoint: string, folder: string): boolean {
  if (typeof url !== 'string' || url.length > 2048) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
  if (/%2e|%2f|%5c/i.test(parsed.pathname) || parsed.pathname.includes('/../')) return false;

  let base: URL;
  try {
    base = new URL(endpoint || 'https://ik.imagekit.io/');
  } catch {
    return false;
  }
  if (!endpoint) {
    // Endpoint not configured: fall back to requiring the ImageKit CDN host.
    if (parsed.hostname !== 'ik.imagekit.io' && !parsed.hostname.endsWith('.imagekit.io')) return false;
    return parsed.pathname.includes(`${folder.replace(/\/+$/, '')}/`);
  }
  if (parsed.origin !== base.origin) return false;
  const prefix = `${base.pathname.replace(/\/+$/, '')}${folder.replace(/\/+$/, '')}/`;
  return parsed.pathname.startsWith(prefix) && parsed.pathname.length > prefix.length;
}

/** True if an ImageKit `filePath` (e.g. "/innovision/gallery/x.webp") is a file directly inside `folder`. */
export function isImageKitPathInFolder(filePath: unknown, folder: string): boolean {
  if (typeof filePath !== 'string') return false;
  const prefix = `${folder.replace(/\/+$/, '')}/`;
  return filePath.startsWith(prefix) && !filePath.slice(prefix.length).includes('/') && !filePath.includes('..');
}

/* ---------------------------------------------------------------------------------------------------------------
 * PostgREST filter safety
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Makes free text safe to interpolate into a PostgREST `.or()` / `ilike` filter string. Characters with filter
 * meaning (`,` `(` `)` `"` `\` `:` and the `*`/`%` wildcards) are removed so a search can't add extra conditions.
 */
export function sanitizeFilterValue(input: unknown, maxLength = 100): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[,()"'\\:*%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

const SAFE_FILTER_EMAIL = /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** True if `email` can be placed in a PostgREST filter without quoting. */
export function isFilterSafeEmail(email: unknown): email is string {
  return typeof email === 'string' && email.length <= 254 && SAFE_FILTER_EMAIL.test(email);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/* ---------------------------------------------------------------------------------------------------------------
 * Registration payload validation
 * ------------------------------------------------------------------------------------------------------------- */

export interface RegistrationInput {
  name: string;
  college: string;
  phone: string;
  enrollment_no: string | null;
  gender: RegistrationGender;
  payment_screenshot_url: string | null;
  utr: string | null;
}

/** Must match GENDER_OPTIONS in validation.ts and the registrations.gender CHECK in supabase/schema.sql. */
export const REGISTRATION_GENDERS = ['male', 'female', 'others'] as const;
export type RegistrationGender = (typeof REGISTRATION_GENDERS)[number];

export type RegistrationValidation =
  | { ok: true; data: RegistrationInput }
  | { ok: false; error: string };

const optionalString = (v: unknown): string | null | undefined =>
  v === undefined || v === null ? null : typeof v === 'string' ? v : undefined;

/**
 * Validates and normalises the body of POST /api/register. Mirrors the rules the registration form already
 * enforces client-side, so legitimate submissions are unaffected.
 */
export function validateRegistrationInput(
  body: unknown,
  opts: { isInternal: boolean; imagekitEndpoint: string }
): RegistrationValidation {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body.' };
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name.replace(/\s+/g, ' ').trim() : '';
  const college = typeof b.college === 'string' ? b.college.replace(/\s+/g, ' ').trim() : '';
  const rawPhone = typeof b.phone === 'string' || typeof b.phone === 'number' ? String(b.phone) : '';
  const enrollment = optionalString(b.enrollment_no);
  const gender = typeof b.gender === 'string' ? b.gender.trim().toLowerCase() : '';
  const payShot = optionalString(b.payment_screenshot_url);
  const rawUtr = optionalString(b.utr);

  if (!name || !rawPhone || (!opts.isInternal && !college)) {
    return { ok: false, error: 'Missing required fields: name, college, and phone are mandatory.' };
  }
  if (enrollment === undefined || payShot === undefined || rawUtr === undefined) {
    return { ok: false, error: 'Invalid field types in registration payload.' };
  }
  if (name.length < 2 || name.length > 100) {
    return { ok: false, error: 'Name must be between 2 and 100 characters.' };
  }
  if (!opts.isInternal && (college.length < 3 || college.length > 200)) {
    return { ok: false, error: 'College name must be between 3 and 200 characters.' };
  }
  if (!(REGISTRATION_GENDERS as readonly string[]).includes(gender)) {
    return { ok: false, error: 'Select a gender: male, female or others.' };
  }

  const phone = rawPhone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return { ok: false, error: 'Use a valid 10-digit Indian mobile number.' };
  }

  const enrollment_no = enrollment ? enrollment.trim() : '';
  if (enrollment_no.length > 50 || (enrollment_no && !/^[A-Za-z0-9/_ -]+$/.test(enrollment_no))) {
    return { ok: false, error: 'Enrollment number contains invalid characters.' };
  }

  if (opts.isInternal) {
    return {
      ok: true,
      data: {
        name,
        college,
        phone,
        enrollment_no: enrollment_no || null,
        gender: gender as RegistrationGender,
        payment_screenshot_url: null,
        utr: null,
      },
    };
  }

  if (!payShot) {
    return { ok: false, error: 'Payment screenshot is required for external students.' };
  }
  if (!isImageKitUrlInFolder(payShot, opts.imagekitEndpoint, '/innovision/payments')) {
    return { ok: false, error: 'Invalid payment screenshot upload. Please re-upload your screenshot.' };
  }
  const utr = (rawUtr || '').replace(/\s+/g, '');
  if (!/^\d{12}$/.test(utr)) {
    return { ok: false, error: 'A valid 12-digit UPI transaction ID (UTR) is required.' };
  }

  return {
    ok: true,
    data: {
      name,
      college,
      phone,
      enrollment_no: enrollment_no || null,
      gender: gender as RegistrationGender,
      payment_screenshot_url: payShot,
      utr,
    },
  };
}

/** Random `IV26-NNNN` id from a CSPRNG (the format the pass/login UI expects). */
export function generateRegistrationId(): string {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return `IV26-${1000 + (buf[0] % 9000)}`;
}

/* ---------------------------------------------------------------------------------------------------------------
 * CSRF: same-origin check for state-changing requests
 * ------------------------------------------------------------------------------------------------------------- */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Rejects cross-site state-changing requests. Browsers always send `Origin` on cross-origin POST/PATCH/DELETE,
 * and `Sec-Fetch-Site` on all modern fetches; requests with neither (curl, server-to-server) carry no ambient
 * browser cookies to abuse and are allowed through to the route's own auth.
 */
export function isCrossSiteMutation(req: {
  method: string;
  headers: { get(name: string): string | null };
}): boolean {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return false;

  const origin = req.headers.get('origin');
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return true; // "null" or malformed origin
    }
    const hosts = [req.headers.get('host'), req.headers.get('x-forwarded-host')]
      .flatMap((h) => (h ? h.split(',') : []))
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    return !hosts.includes(originHost);
  }

  const site = req.headers.get('sec-fetch-site');
  return site === 'cross-site';
}

/* ---------------------------------------------------------------------------------------------------------------
 * Rate limiting (best-effort, per server instance)
 * ------------------------------------------------------------------------------------------------------------- */

export interface RateLimiter {
  /** Records a hit for `key`; returns false once `limit` hits have been seen inside the window. */
  hit(key: string, now?: number): boolean;
}

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    hit(key, now = Date.now()) {
      if (buckets.size > 10_000) {
        for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      }
      const b = buckets.get(key);
      if (!b || b.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      b.count += 1;
      return b.count <= limit;
    },
  };
}

/**
 * Best-effort client IP for rate-limit keys. Behind Cloudflare, `CF-Connecting-IP` is set by the edge and can't be
 * spoofed by the client (as long as the origin only accepts traffic from Cloudflare); the others are fallbacks.
 */
export function clientIp(headers: { get(name: string): string | null }): string {
  return (
    headers.get('cf-connecting-ip')?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/* ---------------------------------------------------------------------------------------------------------------
 * Session records
 * ------------------------------------------------------------------------------------------------------------- */

/** One-way digest of a refresh token for the user_sessions audit table: a DB leak must not yield usable sessions. */
export function hashSessionToken(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}
