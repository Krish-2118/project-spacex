/**
 * Client & Server safe validation utilities for Innovision 2026.
 */

export const ITER_SOA_ERROR_MESSAGE =
  "Students of ITER / SOA (Siksha 'O' Anusandhan) are not allowed to register for Innovision 2026.";

/** Whole words: ITER, SOA, SOAU, and the same spelt out with dots or spaces (I.T.E.R., S O A). */
const ITER_SOA_WORD = /(^| )(iter|soa|soau|i t e r|s o a|s o a u)( |$)/;

/**
 * With spaces and punctuation gone: ITER-SOA / SOA ITER, Institute of Technical Education (and/&) Research, and
 * Siksha 'O' Anusandhan however it is spelt (Shiksha, Sikha, O or no O, Anushandhan, Anusandhaan).
 */
const ITER_SOA_COMPACT = /itersoa|soaiter|technicaleducationa?n?d?research|sh?ik?s?h?a+o?a*nush?andh?a+n/;

/**
 * True when a college name is ITER (Institute of Technical Education and Research) or SOA (Siksha 'O' Anusandhan),
 * whatever the case, spelling, punctuation, accents or full-width letters. Must match public.is_iter_soa_college in
 * supabase/schema.sql (section 18).
 */
export function isIterSoaCollege(college: string | null | undefined): boolean {
  if (typeof college !== 'string') return false;
  // "I.T.E.R., S.O.A" -> "i t e r s o a"
  const spaced = college
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return ITER_SOA_WORD.test(spaced) || ITER_SOA_COMPACT.test(spaced.replace(/ /g, ''));
}

/** True for an ITER / SOA email address (@soa.ac.in, @iter.ac.in and their subdomains). */
export function isIterSoaEmail(email: string | null | undefined): boolean {
  if (typeof email !== 'string') return false;
  return /@([a-z0-9-]+\.)*(soa|iter)\./.test(email.trim().toLowerCase());
}

/** The database refused a registration as ITER / SOA (trg_refuse_iter_soa_registration in supabase/schema.sql). */
export function isIterSoaRefusal(err: { message?: string } | null | undefined): boolean {
  return /ITER \/ SOA registrations are not allowed/i.test(err?.message ?? '');
}

export const PHONE_IN_USE_ERROR_MESSAGE =
  'This phone number is already linked to another account. Please use a different number.';

/** True for a Postgres unique violation (23505) on a phone column, e.g. `profiles_phone_key`. */
export function isDuplicatePhoneError(
  err: { code?: string; message?: string; details?: string | null } | null | undefined
): boolean {
  return !!err && err.code === '23505' && /phone/i.test(`${err.message ?? ''} ${err.details ?? ''}`);
}

/** Gender options for registration (values must match the registrations.gender CHECK in supabase/schema.sql). */
export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'others', label: 'Others' },
] as const;

export type Gender = (typeof GENDER_OPTIONS)[number]['value'];

export function isGender(value: unknown): value is Gender {
  return GENDER_OPTIONS.some((g) => g.value === value);
}

/**
 * Referral codes: 6 characters from an alphabet without look-alikes (no 0/O, no 1/I). The database generates them
 * (public.new_referral_code in supabase/schema.sql, section 14) and checks this same pattern.
 */
export const REFERRAL_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

/**
 * Campus ambassador codes: 'CA' + 6 characters from the same alphabet (public.new_ambassador_code, section 16), shown
 * as CA-K7QM2X. The length tells them apart from a registrant's code, so the one referral field takes either.
 */
export const AMBASSADOR_CODE_PATTERN = /^CA[A-HJ-NP-Z2-9]{6}$/;

/** Shown when a typed code has neither shape. */
export const REFERRAL_CODE_FORMAT_ERROR =
  'Referral codes are 6 letters and numbers, or CA- and 6 more for a campus ambassador. Check the code, or leave it empty.';

/**
 * Spaces (including non-breaking and zero-width ones) and dashes of any kind (a hyphen, an en/em dash, a minus sign,
 * a soft hyphen), as copying a code out of a chat app or a PDF tends to add them.
 * Must match REFERRAL_CODE_NOISE in security.ts.
 */
const REFERRAL_CODE_NOISE = /[\s­​-‍⁠‐-―−﹘﹣－-]+/g;

/** What a registrant typed as someone's referral code, upper-cased without spaces or dashes ('' when left empty). */
export function normalizeReferralCode(value: string): string {
  return value.replace(REFERRAL_CODE_NOISE, '').toUpperCase();
}

/** A normalized code of either shape: a registrant's or a campus ambassador's. */
export function isReferralCode(code: string): boolean {
  return REFERRAL_CODE_PATTERN.test(code) || AMBASSADOR_CODE_PATTERN.test(code);
}

/** How a stored code is shown and shared: CAK7QM2X as CA-K7QM2X; a registrant's code as it is. */
export function formatReferralCode(code: string): string {
  return AMBASSADOR_CODE_PATTERN.test(code) ? `CA-${code.slice(2)}` : code;
}

/**
 * Validates whether a given URL is a legitimate Google Drive or Google Docs link.
 */
export function isValidGoogleDriveUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const trimmed = url.trim();
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    const isGoogleDrive =
      host === 'drive.google.com' ||
      host.endsWith('.drive.google.com') ||
      host === 'docs.google.com' ||
      host.endsWith('.docs.google.com');

    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      isGoogleDrive &&
      parsed.pathname.length > 1
    );
  } catch {
    return false;
  }
}

/**
 * Returns `url` only if it is an absolute http(s) URL, otherwise null. Use before putting stored, user-supplied
 * URLs into `href`/`src` so `javascript:`/`data:` payloads can never execute.
 */
export function safeHttpUrl(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * Quotes one CSV cell and neutralises spreadsheet formula injection (cells starting with = + - @ tab or CR).
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
