import { getSupabaseAdmin } from '@/lib/supabase';
import { hashSessionToken } from '@/lib/security';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export type StaffRole = 'admin' | 'it-team' | 'registration-team' | 'viewer';

export interface StaffAuthSuccess {
  user: User;
  role: StaffRole;
  supabase: SupabaseClient;
  /** The caller's validated access token, for calls that must run as the caller (getSupabaseAsUser). */
  token: string;
}

export interface StaffAuthFailure {
  error: string;
  status: number;
}

export type StaffAuthResult = StaffAuthSuccess | StaffAuthFailure;

/**
 * Where a caller's tokens are read from: a route handler's NextRequest, or `{ headers: await headers(), cookies:
 * await cookies() }` in a server component (next/headers).
 */
export interface AuthSource {
  /** Set on a route handler's NextRequest: GET requests may use the short auth caches below. */
  method?: string;
  headers: { get(name: string): string | null };
  cookies: {
    get(name: string): { value: string } | undefined;
    getAll(): { name: string; value: string }[];
  };
}

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
export function extractAccessTokens(req: AuthSource): string[] {
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
 * True when a JWT's own `exp` has passed. Lets callers skip a request Supabase Auth could only refuse: old cookies
 * outlive their hour-long tokens by days. Only ever rejects: a token that looks valid still goes to Supabase Auth, and
 * one that can't be read is left for Supabase Auth to judge.
 */
export function isTokenExpired(token: string, now = Date.now()): boolean {
  const exp = tokenExp(token);
  return exp !== null && exp * 1000 <= now;
}

function tokenExp(token: string): number | null {
  try {
    const exp = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf-8'))?.exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/*
 * Short in-process caches for read-only requests. Every call to Supabase adds to the project's Logs Ingest quota, and
 * the dashboard and MY PASS poll, so each poll re-validating its token and re-reading the role adds up quickly. Writes
 * and the check-in scanner always ask Supabase live. Kept on globalThis because route bundles may not share module
 * state. Per server instance, so a cold instance just asks Supabase again.
 *   - Identity: a signed-out or deleted account keeps reading for at most IDENTITY_TTL_MS on an instance that saw it.
 *   - Role: a staff member who loses a role keeps read access for at most ROLE_TTL_MS on such an instance.
 */
const IDENTITY_TTL_MS = 5 * 60 * 1000;
const ROLE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 5000;

interface AuthCaches {
  identities: Map<string, { user: User; expires: number }>;
  roles: Map<string, { role: string; expires: number }>;
}
const globals = globalThis as typeof globalThis & { __innovisionAuthCaches?: AuthCaches };
const caches: AuthCaches = (globals.__innovisionAuthCaches ??= { identities: new Map(), roles: new Map() });

function remember<T extends { expires: number }>(cache: Map<string, T>, key: string, entry: T) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
    // Still full: drop the oldest entries (a Map iterates in insertion order).
    for (const k of cache.keys()) {
      if (cache.size < MAX_CACHE_ENTRIES) break;
      cache.delete(k);
    }
  }
  cache.set(key, entry);
}

/** Drops a cached role at once on this instance (the role was just changed here). */
export function forgetCachedRole(userId: string) {
  caches.roles.delete(userId);
}

/**
 * Validates the caller's access token with Supabase Auth (signature + expiry + revocation) and returns the user.
 * Never spends refresh tokens: rotating them here without re-issuing cookies would revoke the user's real session
 * (Supabase refresh-token reuse detection). Clients refresh via the Supabase SDK or GET /api/auth/session.
 *
 * A GET request may reuse a recent validation of the same token (see the caches above), as may a polled route that
 * passes `cached`. An entry never outlives the token's own expiry.
 */
export async function getAuthenticatedUser(
  req: AuthSource,
  { cached = req.method === 'GET' }: { cached?: boolean } = {}
): Promise<AuthenticatedUser | null> {
  const verifier = getSupabaseAdmin();
  const now = Date.now();

  for (const token of extractAccessTokens(req)) {
    if (isTokenExpired(token, now)) continue;

    const key = hashSessionToken(token);
    if (cached) {
      const hit = caches.identities.get(key);
      if (hit && hit.expires > now) return { user: hit.user, token };
    }

    const { data, error } = await verifier.auth.getUser(token);
    if (!error && data?.user) {
      const exp = tokenExp(token);
      remember(caches.identities, key, {
        user: data.user,
        expires: Math.min(now + IDENTITY_TTL_MS, exp === null ? now + IDENTITY_TTL_MS : exp * 1000),
      });
      return { user: data.user, token };
    }
    // Refused by Supabase Auth (signed out, say): a validation cached earlier no longer stands.
    caches.identities.delete(key);
  }

  return null;
}

/** The caller's role row. A GET request may reuse a recent read (see the caches above); a write always reads it live. */
async function readProfileRole(req: AuthSource, supabase: SupabaseClient, userId: string) {
  const now = Date.now();
  if (req.method === 'GET') {
    const hit = caches.roles.get(userId);
    if (hit && hit.expires > now) return { data: { role: hit.role }, error: null };
  }
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (data && !error) remember(caches.roles, userId, { role: data.role, expires: now + ROLE_TTL_MS });
  else caches.roles.delete(userId);
  return { data, error };
}

/**
 * Server-side helper to verify that the request originates from an authorized
 * IT Team member or Administrator ('admin' or 'it-team' role).
 */
export async function verifyEventStaff(req: AuthSource): Promise<StaffAuthResult> {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return { error: 'Unauthorized: Session missing or expired. Please sign in again.', status: 401 };
  }

  const supabase = getSupabaseAdmin(auth.token);
  const { data: profile, error: profErr } = await readProfileRole(req, supabase, auth.user.id);

  if (profErr || !profile || !['admin', 'it-team'].includes(profile.role)) {
    return { error: 'Forbidden: Admin or IT-Team authorization required.', status: 403 };
  }

  return { user: auth.user, role: profile.role as StaffRole, supabase, token: auth.token };
}

/**
 * Server-side helper to verify that the request originates from an authorized
 * Registration Team member or Administrator ('admin' or 'registration-team' role).
 */
export async function verifyRegistrationStaff(req: AuthSource): Promise<StaffAuthResult> {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return { error: 'Unauthorized: Session missing or expired. Please sign in again.', status: 401 };
  }

  const supabase = getSupabaseAdmin(auth.token);
  const { data: profile, error: profErr } = await readProfileRole(req, supabase, auth.user.id);

  if (profErr || !profile || !['admin', 'registration-team'].includes(profile.role)) {
    return { error: 'Forbidden: Admin or Registration-Team authorization required.', status: 403 };
  }

  return { user: auth.user, role: profile.role as StaffRole, supabase, token: auth.token };
}

/**
 * Read-only access to registration data: the Registration Team and Administrators, plus the 'viewer' role (sees
 * everything the registration team sees, changes nothing). Only for GET handlers; writes stay on
 * verifyRegistrationStaff.
 */
export async function verifyRegistrationViewer(req: AuthSource): Promise<StaffAuthResult> {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return { error: 'Unauthorized: Session missing or expired. Please sign in again.', status: 401 };
  }

  const supabase = getSupabaseAdmin(auth.token);
  const { data: profile, error: profErr } = await readProfileRole(req, supabase, auth.user.id);

  if (profErr || !profile || !['admin', 'registration-team', 'viewer'].includes(profile.role)) {
    return { error: 'Forbidden: Admin, Registration-Team or Viewer authorization required.', status: 403 };
  }

  return { user: auth.user, role: profile.role as StaffRole, supabase, token: auth.token };
}

/** Like verifyEventStaff / verifyRegistrationStaff, but only lets the 'admin' role through. */
export async function verifyAdmin(req: AuthSource): Promise<StaffAuthResult> {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return { error: 'Unauthorized: Session missing or expired. Please sign in again.', status: 401 };
  }

  const supabase = getSupabaseAdmin(auth.token);
  const { data: profile, error: profErr } = await readProfileRole(req, supabase, auth.user.id);

  if (profErr || !profile || profile.role !== 'admin') {
    return { error: 'Forbidden: Superadmin access required to modify user roles', status: 403 };
  }

  return { user: auth.user, role: profile.role as StaffRole, supabase, token: auth.token };
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
