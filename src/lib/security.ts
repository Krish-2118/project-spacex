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
 * Payment proofs (private Supabase Storage bucket)
 * ------------------------------------------------------------------------------------------------------------- */

/** Private bucket holding payment screenshots. Created, and kept private, by supabase/schema.sql. */
export const PAYMENT_PROOFS_BUCKET = 'payment-proofs';

/** Lifetime of the signed links staff get to view a payment screenshot. */
export const PAYMENT_PROOF_URL_TTL_SECONDS = 300;

/** Image types accepted as a payment screenshot (never PDFs); must match the bucket's allowed_mime_types. */
export const PAYMENT_PROOF_MIME_TYPES = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
} as const satisfies Partial<Record<DetectedFileType, string>>;

export type PaymentProofFileType = keyof typeof PAYMENT_PROOF_MIME_TYPES;

export function isPaymentProofFileType(type: unknown): type is PaymentProofFileType {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(PAYMENT_PROOF_MIME_TYPES, type);
}

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
// `<owner uuid>/<random uuid>.<ext>`: the same shape the Storage INSERT policy and the registrations CHECK enforce.
const PAYMENT_PROOF_PATH_RE = new RegExp(`^(${UUID_PATTERN})/${UUID_PATTERN}\\.(jpg|png|webp|gif|heic)$`);

/**
 * Object path for a new payment screenshot. The folder is the uploader's verified user id (from the session, never
 * from the request) and the file name is random, so a path can't be guessed or chosen by the client.
 */
export function buildPaymentProofPath(ownerId: string, type: PaymentProofFileType): string {
  if (!isUuid(ownerId)) throw new Error('buildPaymentProofPath: owner id must be a UUID');
  return `${ownerId.toLowerCase()}/${globalThis.crypto.randomUUID()}.${FILE_EXTENSIONS[type]}`;
}

/** True when `path` is a payment-proof object path inside `ownerId`'s own folder (no traversal, no other user). */
export function isPaymentProofPath(path: unknown, ownerId: unknown): path is string {
  if (typeof path !== 'string' || !isUuid(ownerId)) return false;
  const m = PAYMENT_PROOF_PATH_RE.exec(path);
  return !!m && m[1] === ownerId.toLowerCase();
}

/* ---------------------------------------------------------------------------------------------------------------
 * Request bodies: bounded reads
 * ------------------------------------------------------------------------------------------------------------- */

export type BodyResult<T> = { ok: true; value: T } | { ok: false; status: 400 | 413; error: string };

/** Default cap for JSON API bodies; the largest legitimate one (a registration) is well under 2 KB. */
export const MAX_JSON_BODY_BYTES = 64 * 1024;

const tooLarge = { ok: false, status: 413, error: 'Request body is too large.' } as const;

/**
 * Reads at most `maxBytes` of a request body. Enforced on the bytes actually received, not only on the declared
 * Content-Length, so chunked/streamed bodies can't make the server buffer an unbounded payload.
 */
export async function readBodyLimited(req: Request, maxBytes: number): Promise<BodyResult<Uint8Array>> {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > maxBytes) return tooLarge;
  if (!req.body) return { ok: true, value: new Uint8Array(0) };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return tooLarge;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return { ok: true, value: out };
}

/** Parses a bounded JSON body that must be a plain object. */
export async function readJsonObject(
  req: Request,
  maxBytes = MAX_JSON_BODY_BYTES
): Promise<BodyResult<Record<string, unknown>>> {
  const body = await readBodyLimited(req, maxBytes);
  if (!body.ok) return body;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(body.value));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, value: parsed as Record<string, unknown> };
    }
  } catch {}
  return { ok: false, status: 400, error: 'Request body must be a JSON object.' };
}

/** Parses a bounded multipart/form-data (or urlencoded) body. */
export async function readFormLimited(req: Request, maxBytes: number): Promise<BodyResult<FormData>> {
  const body = await readBodyLimited(req, maxBytes);
  if (!body.ok) return body;
  try {
    const form = await new Response(body.value as BodyInit, {
      headers: { 'content-type': req.headers.get('content-type') || '' },
    }).formData();
    return { ok: true, value: form };
  } catch {
    return { ok: false, status: 400, error: 'Request body must be form data.' };
  }
}

/** A text form field, trimmed; undefined when absent or when a file was sent in its place. */
export function formText(form: FormData, name: string): string | undefined {
  const v = form.get(name);
  return typeof v === 'string' ? v.trim() : undefined;
}

/** A non-empty uploaded file field, or null. */
export function formFile(form: FormData, name: string): File | null {
  const v = form.get(name);
  return typeof v === 'object' && v !== null && typeof (v as File).arrayBuffer === 'function' && (v as File).size > 0
    ? (v as File)
    : null;
}

/** A JSON text field, trimmed. `null` means "clear" (''); any non-string value is treated as absent. */
export function jsonText(v: unknown): string | undefined {
  if (v === null) return '';
  return typeof v === 'string' ? v.trim() : undefined;
}

/* ---------------------------------------------------------------------------------------------------------------
 * URL validation
 * ------------------------------------------------------------------------------------------------------------- */

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
  /** Storage object path in the private payment-proofs bucket (never a URL). */
  payment_proof_path: string | null;
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
  opts: { isInternal: boolean; ownerId: string }
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
  const proofPath = optionalString(b.payment_proof_path);
  const rawUtr = optionalString(b.utr);

  if (!name || !rawPhone || (!opts.isInternal && !college)) {
    return { ok: false, error: 'Missing required fields: name, college, and phone are mandatory.' };
  }
  if (enrollment === undefined || proofPath === undefined || rawUtr === undefined) {
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
        payment_proof_path: null,
        utr: null,
      },
    };
  }

  if (!proofPath) {
    return { ok: false, error: 'Payment screenshot is required for external students.' };
  }
  // The path is only accepted inside the caller's own folder (ownerId comes from the verified session), so a
  // registration can never reference another user's proof. /api/register then checks the object really exists.
  if (!isPaymentProofPath(proofPath, opts.ownerId)) {
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
      payment_proof_path: proofPath,
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
