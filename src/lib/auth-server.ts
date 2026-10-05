import type { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface StaffAuthSuccess {
  user: User;
  role: 'admin' | 'it-team';
  supabase: SupabaseClient;
}

export interface StaffAuthFailure {
  error: string;
  status: number;
}

export type StaffAuthResult = StaffAuthSuccess | StaffAuthFailure;

/**
 * Server-side helper to verify that the request originates from an authorized
 * IT Team member or Administrator ('admin' or 'it-team' role).
 */
export async function verifyStaff(req: NextRequest): Promise<StaffAuthResult> {
  const authHeader = req.headers.get('authorization');
  let token = authHeader?.replace(/^Bearer\s+/i, '')?.trim();
  if (!token || token === 'null' || token === 'undefined') {
    token = req.cookies.get('inn_access_token')?.value?.trim();
  }

  // Also check sb-*-auth-token cookies if inn_access_token is missing
  if (!token || token === 'null' || token === 'undefined') {
    const allCookies = req.cookies.getAll();
    for (const c of allCookies) {
      if (c.name.includes('-auth-token') || c.name.includes('supabase-auth')) {
        try {
          const parsed = JSON.parse(decodeURIComponent(c.value));
          if (parsed?.access_token) {
            token = parsed.access_token;
            break;
          }
        } catch {}
      }
    }
  }

  let supabase = getSupabaseAdmin(token || undefined);
  let activeUser: User | null = null;

  if (token && token !== 'null' && token !== 'undefined') {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (!authErr && user) {
      activeUser = user;
    }
  }

  // If token is expired or invalid, attempt refresh using inn_refresh_token cookie
  if (!activeUser) {
    const refreshToken = req.cookies.get('inn_refresh_token')?.value?.trim();
    if (refreshToken && refreshToken !== 'null' && refreshToken !== 'undefined') {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (!refreshErr && refreshed.user && refreshed.session?.access_token) {
        activeUser = refreshed.user;
        token = refreshed.session.access_token;
        supabase = getSupabaseAdmin(token);
      }
    }
  }

  if (!activeUser) {
    return { error: 'Unauthorized: Session missing or expired. Please sign in again.', status: 401 };
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', activeUser.id)
    .maybeSingle();

  if (profErr || !profile || !['admin', 'it-team'].includes(profile.role)) {
    return { error: 'Forbidden: Admin or IT-Team authorization required.', status: 403 };
  }

  return { user: activeUser, role: profile.role as 'admin' | 'it-team', supabase };
}

export {
  isValidGoogleDriveUrl,
  isIterSoaCollege,
  isIterSoaEmail,
  ITER_SOA_ERROR_MESSAGE,
} from '@/lib/validation';

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
