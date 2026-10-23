import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { resolveReferralCode } from '@/lib/ambassadors';
import { registrationsClosedResponse, registrationsOpen } from '@/lib/registration-gate';
import { createRateLimiter, normalizeReferralCode, readJsonObject, referralCodeKind, REFERRAL_CODE_FORMAT_ERROR } from '@/lib/security';

export const runtime = 'nodejs';

// Codes are 6 random characters from 32 (about a billion per kind), so 20 checks per user per 10 minutes can't
// find a working one by guessing. The answer never says whose code it is.
const checkLimiter = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });

/**
 * POST /api/register/check-code  { code }
 * Checks the referral code typed in the registration form before the student pays: { valid: true, kind } or
 * { valid: false, error }, under the same rules as POST /api/register (src/lib/ambassadors.ts), which checks it again
 * on submit. Signed-in callers only (the request proxy also gates /api/register/*), while registrations are open.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth || !auth.user.email) {
      return NextResponse.json({ error: 'Please log in to continue.' }, { status: 401 });
    }
    const { user, token } = auth;
    const verifiedEmail = auth.user.email.toLowerCase().trim();
    if (!registrationsOpen()) return registrationsClosedResponse();

    if (!checkLimiter.hit(user.id)) {
      return NextResponse.json(
        { error: 'Too many code checks. Please wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(checkLimiter.retryAfterSeconds(user.id)) } }
      );
    }

    const body = await readJsonObject(req);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
    if (typeof body.value.code !== 'string' || body.value.code.length > 64) {
      return NextResponse.json({ error: 'Send the code as a string.' }, { status: 400 });
    }
    const code = normalizeReferralCode(body.value.code);
    if (!referralCodeKind(code)) return NextResponse.json({ valid: false, error: REFERRAL_CODE_FORMAT_ERROR });

    const referral = await resolveReferralCode(getSupabaseAdmin(token), code, { userId: user.id, email: verifiedEmail });
    if (!referral.ok) {
      return referral.status === 500
        ? NextResponse.json({ error: referral.error }, { status: 500 })
        : NextResponse.json({ valid: false, error: referral.error });
    }
    return NextResponse.json({ valid: true, kind: referral.kind });
  } catch (err: unknown) {
    console.error('API /api/register/check-code error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
