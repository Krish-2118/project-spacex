import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createRateLimiter } from '@/lib/security';

export const runtime = 'nodejs';

// The form asks once each time it opens while the cap is reached, so this only stops abuse.
const accessLimiter = createRateLimiter({ limit: 60, windowMs: 10 * 60 * 1000 });

/**
 * GET /api/register/female-access
 * Whether this student may still choose Female or Others at the cap, because they may already have paid
 * (female_seat_kept, supabase/schema.sql section 21): { keepsAccess }. Display only: start-payment and the database
 * make the same check themselves.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth || !auth.user.email) {
      return NextResponse.json({ error: 'Please log in to continue.' }, { status: 401 });
    }
    const { user, token } = auth;

    if (!accessLimiter.hit(user.id)) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(accessLimiter.retryAfterSeconds(user.id)) } }
      );
    }

    const { data, error } = await getSupabaseAdmin(token).rpc('female_seats_status', { p_user_id: user.id });
    if (error || !data) {
      console.error('/api/register/female-access failed:', error);
      return NextResponse.json({ error: 'Could not check your registration.' }, { status: 500 });
    }
    return NextResponse.json({ keepsAccess: data.keeps_access === true });
  } catch (err: unknown) {
    console.error('API /api/register/female-access error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
