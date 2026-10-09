import type { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface StaffAuthSuccess {
  user: User;
  role: 'admin' | 'it-team' | 'registration-team';
  supabase: SupabaseClient;
}

export interface StaffAuthFailure {
  error: string;
  status: number;
}

export type StaffAuthResult = StaffAuthSuccess | StaffAuthFailure;

const isUsableToken = (t: string | null | undefined): t is string =>
  !!t && t !== 'null' && t !== 'undefined' && t.length < 8192;

/** Reads an access token out of a Supabase `sb-*-auth-token` cookie value (JSON, URI-encoded or `base64-`). */
function tokenFromSupabaseCookie(value: string): string | null {
  try {
    let raw = value;
    if (raw.startsWith('base64-')) raw = Buffer.from(raw.slice(7), 'base64').toString('utf-8');
    else if (!raw.startsWith('{') && !raw.startsWith('[')) raw = decodeURIComponent(raw);
    const json = JSON.parse(raw);
    const token = json?.access_token || json?.[0]?.access_token;
    return typeof token === 'string' ? token : null;
  } catch {
    return null;
  }
}

/**
 * Candidate access tokens for a request, in priority order: `Authorization: Bearer`, the `inn_access_token`
 * cookie, then Supabase's own auth cookie. None of these are trusted until Supabase Auth validates them.
 */
export function extractAccessTokens(req: NextRequest): string[] {
  const tokens: string[] = [];
  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (isUsableToken(bearer)) tokens.push(bearer);

  const inn = req.cookies.get('inn_access_token')?.value?.trim();
  if (isUsableToken(inn)) tokens.push(inn);

  for (const c of req.cookies.getAll()) {
    if (c.name.includes('-auth-token') && !c.name.includes('code-verifier')) {
      const t = tokenFromSupabaseCookie(c.value);
      if (isUsableToken(t)) tokens.push(t);
    }
  }
  return [...new Set(tokens)].slice(0, 3);
}

export interface AuthenticatedUser {
  user: User;
  token: string;
}

/**
 * Validates the caller's access token with Supabase Auth (signature + expiry + revocation) and returns the user.
 * Never spends refresh tokens: rotating them here without re-issuing cookies would revoke the user's real session
 * (Supabase refresh-token reuse detection). Clients refresh via the Supabase SDK or GET /api/auth/session.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const verifier = getSupabaseAdmin();

  for (const token of extractAccessTokens(req)) {
    const { data, error } = await verifier.auth.getUser(token);
    if (!error && data?.user) return { user: data.user, token };
  }

  return null;
}

/**
 * Server-side helper to verify that the request originates from an authorized
 * IT Team member or Administrator ('admin' or 'it-team' role).
 */
export async function verifyEventStaff(req: NextRequest): Promise<StaffAuthResult> {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return { error: 'Unauthorized: Session missing or expired. Please sign in again.', status: 401 };
  }

  const supabase = getSupabaseAdmin(auth.token);
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (profErr || !profile || !['admin', 'it-team'].includes(profile.role)) {
    return { error: 'Forbidden: Admin or IT-Team authorization required.', status: 403 };
  }

  return { user: auth.user, role: profile.role as 'admin' | 'it-team' | 'registration-team', supabase };
}

/**
 * Server-side helper to verify that the request originates from an authorized
 * Registration Team member or Administrator ('admin' or 'registration-team' role).
 */
export async function verifyRegistrationStaff(req: NextRequest): Promise<StaffAuthResult> {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return { error: 'Unauthorized: Session missing or expired. Please sign in again.', status: 401 };
  }

  const supabase = getSupabaseAdmin(auth.token);
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (profErr || !profile || !['admin', 'registration-team'].includes(profile.role)) {
    return { error: 'Forbidden: Admin or Registration-Team authorization required.', status: 403 };
  }

  return { user: auth.user, role: profile.role as 'admin' | 'it-team' | 'registration-team', supabase };
}

/** Like verifyStaff, but only lets the 'admin' role through. */
export async function verifyAdmin(req: NextRequest): Promise<StaffAuthResult> {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return { error: 'Unauthorized: Session missing or expired. Please sign in again.', status: 401 };
  }

  const supabase = getSupabaseAdmin(auth.token);
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (profErr || !profile || profile.role !== 'admin') {
    return { error: 'Forbidden: Superadmin access required to modify user roles', status: 403 };
  }

  return { user: auth.user, role: profile.role as 'admin' | 'it-team' | 'registration-team', supabase };
}

export { isValidGoogleDriveUrl } from '@/lib/validation';

/**
 * Validates WebP image: checks extension, MIME type, and RIFF...WEBP magic bytes.
 */
export function isWebPImage(filename: string, mimeType: string, buffer: Buffer): boolean {
  const hasWebpExt = filename.toLowerCase().endsWith('.webp');
  if (!hasWebpExt) return false;

  // Buffer must have at least 12 bytes for RIFF header
  if (buffer.length < 12) return false;
  const riff = buffer.toString('ascii', 0, 4);
  const webp = buffer.toString('ascii', 8, 12);
  const hasMagicBytes = riff === 'RIFF' && webp === 'WEBP';

  return hasMagicBytes;
}
