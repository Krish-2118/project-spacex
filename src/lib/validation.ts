/**
 * Client & Server safe validation utilities for Innovision 2026.
 */

export const ITER_SOA_ERROR_MESSAGE =
  'Registration is not allowed for students from ITER - SOA.';

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
 * Validates whether a college string corresponds to ITER - SOA
 * (Institute of Technical Education and Research / Siksha 'O' Anusandhan).
 *
 * Students from ITER - SOA are strictly not allowed to register for Innovision.
 */
export function isIterSoaCollege(college: string): boolean {
  if (!college || typeof college !== 'string') return false;

  const raw = college.toLowerCase().trim();

  // Strip periods e.g. "I.T.E.R." -> "iter", "S.O.A." -> "soa"
  const noDots = raw.replace(/\./g, '');
  // Normalize punctuation and symbols to spaces
  const clean = noDots.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Check full names and phrases
  if (
    clean.includes('institute of technical education') ||
    clean.includes('siksha o anusandhan') ||
    clean.includes('shiksha o anusandhan') ||
    clean.includes('siksha o anushandhan') ||
    clean.includes('shiksha o anushandhan') ||
    clean.includes('siksha ‘o’ anusandhan') ||
    clean.includes('siksha \'o\' anusandhan') ||
    ((clean.includes('siksha') || clean.includes('shiksha')) && (clean.includes('anusandhan') || clean.includes('anushandhan')))
  ) {
    return true;
  }

  // 2. Check standalone tokens
  const words = clean.split(/\s+/);
  if (words.includes('iter') || words.includes('soa')) {
    return true;
  }

  // 3. Check compact combinations e.g. "itersoa", "soaiter", "iter-soa"
  const compact = raw.replace(/[^a-z0-9]/g, '');
  if (
    compact.includes('itersoa') ||
    compact.includes('soaiter') ||
    compact === 'iter' ||
    compact === 'soa'
  ) {
    return true;
  }

  return false;
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

/**
 * Checks if an email address belongs to ITER / SOA university domains.
 */
export function isIterSoaEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase().trim();
  return (
    lower.endsWith('@soa.ac.in') ||
    lower.endsWith('@iter.ac.in') ||
    lower.includes('@soa.') ||
    lower.includes('@iter.')
  );
}
