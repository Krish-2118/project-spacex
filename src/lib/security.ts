/**
 * Server-side security helpers for Innovision 2026.
 *
 * Kept free of `@/` imports and framework APIs so they can be unit tested directly with `node --test`.
 */

import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

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

/**
 * Object path for a new private upload (payment screenshot, ID card). The folder is the uploader's verified user id
 * (from the session, never from the request) and the file name is random, so a path can't be guessed or chosen by the
 * client.
 */
export function buildOwnedUploadPath(ownerId: string, type: DetectedFileType): string {
  if (!isUuid(ownerId)) throw new Error('buildOwnedUploadPath: owner id must be a UUID');
  return `${ownerId.toLowerCase()}/${globalThis.crypto.randomUUID()}.${FILE_EXTENSIONS[type]}`;
}

/**
 * True when `path` is `<owner uuid>/<random uuid>.<ext>` inside `ownerId`'s own folder (no traversal, no other user)
 * with one of `extensions`: the same shape the registrations CHECKs enforce.
 */
export function isOwnedUploadPath(path: unknown, ownerId: unknown, extensions: readonly string[]): path is string {
  if (typeof path !== 'string' || !isUuid(ownerId)) return false;
  const m = new RegExp(`^(${UUID_PATTERN})/${UUID_PATTERN}\\.([a-z]+)$`).exec(path);
  return !!m && m[1] === ownerId.toLowerCase() && extensions.includes(m[2]);
}

const PAYMENT_PROOF_EXTENSIONS = ['jpg', 'png', 'webp', 'gif', 'heic'];

/** Object path for a new payment screenshot (buildOwnedUploadPath). */
export function buildPaymentProofPath(ownerId: string, type: PaymentProofFileType): string {
  return buildOwnedUploadPath(ownerId, type);
}

/** True when `path` is a payment-proof object path inside `ownerId`'s own folder (no traversal, no other user). */
export function isPaymentProofPath(path: unknown, ownerId: unknown): path is string {
  return isOwnedUploadPath(path, ownerId, PAYMENT_PROOF_EXTENSIONS);
}

/* ---------------------------------------------------------------------------------------------------------------
 * College ID cards (private Supabase Storage bucket, supabase/schema.sql section 19)
 * ------------------------------------------------------------------------------------------------------------- */

/** Private bucket holding photos of registrants' college ID cards. Created, and kept private, by supabase/schema.sql. */
export const ID_CARDS_BUCKET = 'id-cards';

/** Largest ID card photo accepted; must match the id-cards bucket file_size_limit in supabase/schema.sql. */
export const ID_CARD_MAX_BYTES = 2 * 1024 * 1024;

/** Image types accepted as an ID card photo; must match the bucket's allowed_mime_types. */
export const ID_CARD_MIME_TYPES = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
} as const satisfies Partial<Record<DetectedFileType, string>>;

export type IdCardFileType = keyof typeof ID_CARD_MIME_TYPES;

export function isIdCardFileType(type: unknown): type is IdCardFileType {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(ID_CARD_MIME_TYPES, type);
}

/** True when `path` is an ID card object path inside `ownerId`'s own folder (registrations_id_card_path_check). */
export function isIdCardPath(path: unknown, ownerId: unknown): path is string {
  return isOwnedUploadPath(path, ownerId, ['jpg', 'png', 'webp', 'heic']);
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
  /** Storage object path in the private payment-proofs bucket (never a URL). Always required. */
  payment_proof_path: string;
  /** Storage object path of the college ID card photo in the private id-cards bucket. Always required. */
  id_card_path: string;
  /** 12-digit UPI transaction id. Always required. */
  utr: string;
  /** Someone else's referral code, normalized; null when left empty (optional). /api/register checks it exists. */
  referred_by_code: string | null;
}

/** Must match GENDER_OPTIONS in validation.ts and the registrations.gender CHECK in supabase/schema.sql. */
export const REGISTRATION_GENDERS = ['male', 'female', 'others'] as const;
export type RegistrationGender = (typeof REGISTRATION_GENDERS)[number];

/** Must match REFERRAL_CODE_PATTERN in validation.ts and registrations_referral_code_check in supabase/schema.sql. */
export const REFERRAL_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
/** Must match AMBASSADOR_CODE_PATTERN in validation.ts and campus_ambassadors_code_check in supabase/schema.sql. */
export const AMBASSADOR_CODE_PATTERN = /^CA[A-HJ-NP-Z2-9]{6}$/;

/** Spaces and dashes of any kind, ignored in a typed code. Must match REFERRAL_CODE_NOISE in validation.ts. */
const REFERRAL_CODE_NOISE = /[\s­​-‍⁠‐-―−﹘﹣－-]+/g;

/**
 * A typed referral code, upper-cased without spaces or dashes ('' when empty). Same as normalizeReferralCode in
 * validation.ts (kept here so this file stays free of `@/` imports): CA-K7QM2X, ca k7qm2x and CA–K7QM2X are CAK7QM2X.
 */
export function normalizeReferralCode(value: string): string {
  return value.replace(REFERRAL_CODE_NOISE, '').toUpperCase();
}

/** Which kind of code a normalized code is, by its shape; null for neither. */
export function referralCodeKind(code: string): 'ambassador' | 'registrant' | null {
  if (AMBASSADOR_CODE_PATTERN.test(code)) return 'ambassador';
  if (REFERRAL_CODE_PATTERN.test(code)) return 'registrant';
  return null;
}

/** Shown when a typed code has neither shape. Must match REFERRAL_CODE_FORMAT_ERROR in validation.ts. */
export const REFERRAL_CODE_FORMAT_ERROR =
  'Referral codes are 6 letters and numbers, or CA- and 6 more for a campus ambassador. Check the code, or leave it empty.';

/** Form field a validation error belongs to, so the registration form can show it on the right step. */
export type RegistrationField =
  | 'name' | 'college' | 'phone' | 'gender' | 'enrollment_no' | 'referred_by_code' | 'idfile' | 'payfile' | 'utr' | 'form';

export type RegistrationValidation =
  | { ok: true; data: RegistrationInput }
  | { ok: false; error: string; field: RegistrationField };

const optionalString = (v: unknown): string | null | undefined =>
  v === undefined || v === null ? null : typeof v === 'string' ? v : undefined;

/**
 * The one registration fee (INR) and the status every new registration starts in. There is no free or auto-confirmed
 * tier: every registrant, whatever their email domain, pays and is reviewed by staff. Never read from the request.
 */
export const REGISTRATION_FEE_INR = 999;
export const NEW_REGISTRATION_STATUS = 'pending';

export const NIT_ROURKELA_COLLEGE = 'National Institute of Technology Rourkela';

/**
 * Reporting label only ('internal' = NIT Rourkela): it has no effect on the fee, status or payment requirements.
 * Derived from the identity provider's verified email, never from the request body. Must match
 * enforce_registration_insert() in supabase/schema.sql.
 */
export function classifyStudentType(email: string, emailConfirmed: boolean): 'internal' | 'external' {
  return emailConfirmed && email.trim().toLowerCase().endsWith('@nitrkl.ac.in') ? 'internal' : 'external';
}

/**
 * Validates and normalises the body of POST /api/register. Mirrors the rules the registration form already
 * enforces client-side, so legitimate submissions are unaffected. The same rules apply to every registrant: a
 * payment proof and a UTR are always required.
 */
export function validateRegistrationInput(
  body: unknown,
  opts: { ownerId: string }
): RegistrationValidation {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body.', field: 'form' };
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name.replace(/\s+/g, ' ').trim() : '';
  const college = typeof b.college === 'string' ? b.college.replace(/\s+/g, ' ').trim() : '';
  const rawPhone = typeof b.phone === 'string' || typeof b.phone === 'number' ? String(b.phone) : '';
  const enrollment = optionalString(b.enrollment_no);
  const gender = typeof b.gender === 'string' ? b.gender.trim().toLowerCase() : '';
  const proofPath = optionalString(b.payment_proof_path);
  const idCardPath = optionalString(b.id_card_path);
  const rawUtr = optionalString(b.utr);
  const rawReferral = optionalString(b.referred_by_code);

  if (!name || !rawPhone || !college) {
    return {
      ok: false,
      error: 'Missing required fields: name, college, and phone are mandatory.',
      field: !name ? 'name' : !college ? 'college' : 'phone',
    };
  }
  if (
    enrollment === undefined || proofPath === undefined || idCardPath === undefined || rawUtr === undefined ||
    rawReferral === undefined
  ) {
    return { ok: false, error: 'Invalid field types in registration payload.', field: 'form' };
  }
  if (name.length < 2 || name.length > 100) {
    return { ok: false, error: 'Name must be between 2 and 100 characters.', field: 'name' };
  }
  if (college.length < 3 || college.length > 200) {
    return { ok: false, error: 'College name must be between 3 and 200 characters.', field: 'college' };
  }
  if (!(REGISTRATION_GENDERS as readonly string[]).includes(gender)) {
    return { ok: false, error: 'Select a gender: male, female or others.', field: 'gender' };
  }

  const phone = rawPhone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return { ok: false, error: 'Use a valid 10-digit Indian mobile number.', field: 'phone' };
  }

  const enrollment_no = enrollment ? enrollment.trim() : '';
  if (!enrollment_no) {
    return { ok: false, error: 'Enter your college roll / enrollment number.', field: 'enrollment_no' };
  }
  if (enrollment_no.length > 50 || (enrollment_no && !/^[A-Za-z0-9/_ -]+$/.test(enrollment_no))) {
    return { ok: false, error: 'Enrollment number contains invalid characters.', field: 'enrollment_no' };
  }

  // Optional: a registrant's or a campus ambassador's code. Same normalization as the form: case, spaces and dashes
  // ignored.
  const referred_by_code = normalizeReferralCode(rawReferral || '');
  if (referred_by_code && !referralCodeKind(referred_by_code)) {
    return { ok: false, error: REFERRAL_CODE_FORMAT_ERROR, field: 'referred_by_code' };
  }

  // Uploaded on the details step, so its errors send the form back there. Same own-folder rule as the proof below.
  if (!idCardPath) {
    return { ok: false, error: 'Upload a photo of the front of your college ID card.', field: 'idfile' };
  }
  if (!isIdCardPath(idCardPath, opts.ownerId)) {
    return { ok: false, error: 'Invalid ID card upload. Please upload your college ID card again.', field: 'idfile' };
  }

  if (!proofPath) {
    return { ok: false, error: 'Payment screenshot is required.', field: 'payfile' };
  }
  // The path is only accepted inside the caller's own folder (ownerId comes from the verified session), so a
  // registration can never reference another user's proof. /api/register then checks the object really exists.
  if (!isPaymentProofPath(proofPath, opts.ownerId)) {
    return { ok: false, error: 'Invalid payment screenshot upload. Please re-upload your screenshot.', field: 'payfile' };
  }
  const utr = (rawUtr || '').replace(/\s+/g, '');
  if (!/^\d{12}$/.test(utr)) {
    return { ok: false, error: 'A valid 12-digit UPI transaction ID (UTR) is required.', field: 'utr' };
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
      id_card_path: idCardPath,
      utr,
      referred_by_code: referred_by_code || null,
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
  /** Whole seconds (at least 1) until `key`'s current window ends, for a `Retry-After` header on a refusal. */
  retryAfterSeconds(key: string, now?: number): number;
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
    retryAfterSeconds(key, now = Date.now()) {
      const resetAt = buckets.get(key)?.resetAt ?? now;
      return Math.max(1, Math.ceil((resetAt - now) / 1000));
    },
  };
}

/**
 * Client IP for per-IP rate-limit keys, or null when no trustworthy address is available.
 *
 * Only headers the hosting platform sets are used. On Vercel the edge overwrites `x-real-ip` / `x-forwarded-for` with
 * the connecting client's address "to prevent IP spoofing" (Vercel docs, request headers), so `trustPlatformHeaders`
 * is true only there (`VERCEL=1`). Headers the platform passes through unchanged, such as `cf-connecting-ip`,
 * `true-client-ip` or `forwarded`, are chosen by the client and are never read.
 *
 * null (off Vercel, or a missing/malformed value) means "skip per-IP limits", never one shared bucket: a shared
 * bucket would let a single client get every visitor refused. The per-user limits in the routes still apply.
 * IPv6 addresses are keyed by their /64, since one subscriber typically controls a whole /64.
 */
export function clientIp(
  headers: { get(name: string): string | null },
  { trustPlatformHeaders }: { trustPlatformHeaders: boolean }
): string | null {
  if (!trustPlatformHeaders) return null;
  return rateLimitIpKey(headers.get('x-real-ip')) ?? rateLimitIpKey(headers.get('x-forwarded-for')?.split(',')[0]);
}

function rateLimitIpKey(raw: string | null | undefined): string | null {
  const ip = raw?.trim().toLowerCase();
  if (!ip || ip.length > 64) return null;
  const version = isIP(ip);
  if (version === 4) return ip;
  if (version !== 6) return null;

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (mapped && isIP(mapped[1]) === 4) return mapped[1];

  // Expand to 8 hextets (an embedded IPv4 tail counts as two), then keep the first four.
  let s = ip.split('%')[0];
  const tail = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (tail) {
    const [a, b, c, d] = tail[2].split('.').map(Number);
    s = `${tail[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, rest] = s.split('::');
  const left = head ? head.split(':') : [];
  const right = rest === undefined ? [] : rest ? rest.split(':') : [];
  const groups = rest === undefined ? left : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
  if (groups.length !== 8) return null;
  return `${groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':')}::/64`;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Session records
 * ------------------------------------------------------------------------------------------------------------- */

/** One-way digest of a refresh token for the user_sessions audit table: a DB leak must not yield usable sessions. */
export function hashSessionToken(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}
