import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { registrationsClosedResponse, registrationsOpen } from '@/lib/registration-gate';
import { ATTEMPTS_USED_UP_ERROR, attemptsLeft } from '@/lib/rejections';
import { FEMALE_SEATS_FULL_MESSAGE, REGISTRATIONS_FULL_MESSAGE } from '@/lib/seats';
import { createRateLimiter, readJsonObject, REGISTRATION_GENDERS } from '@/lib/security';

export const runtime = 'nodejs';

// One call each time a student leaves the details step, so this only stops abuse.
const startLimiter = createRateLimiter({ limit: 30, windowMs: 10 * 60 * 1000 });

/**
 * POST /api/register/start-payment  { gender, fresh? }
 * Called before the form shows any payment details: a live read of the database, never a cached count. Answers with what
 * the student may do (start_payment_for_gender, supabase/schema.sql sections 20 and 21):
 *   { state: 'pay', amount, currentFee }           show the payment details at this fee
 *   { state: 'already_paid', amount, currentFee }  no payment details: continue only if already paid
 *   409 { code: 'registrations_closed', error }    no payment details at all
 *   409 { code: 'female_seats_full', error, field: 'gender' }  no payment details for this gender
 * The fee is locked here: the student may submit at it even if the phase closes or the fee rises meanwhile. `fresh` means
 * the student hasn't paid and wants the current fee instead of an older one they were quoted.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth || !auth.user.email) {
      return NextResponse.json({ error: 'Please log in to continue.' }, { status: 401 });
    }
    const { user, token } = auth;
    if (!registrationsOpen()) return registrationsClosedResponse();

    if (!startLimiter.hit(user.id)) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(startLimiter.retryAfterSeconds(user.id)) } }
      );
    }

    const body = await readJsonObject(req);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });

    // Required, so the seat cap is always checked before anyone is shown a way to pay.
    const { gender } = body.value;
    if (!(REGISTRATION_GENDERS as readonly unknown[]).includes(gender)) {
      return NextResponse.json({ error: 'Select your gender.', field: 'gender' }, { status: 400 });
    }

    // Nobody who can't submit should be shown a way to pay.
    const client = getSupabaseAdmin(token);
    const [active, rejected] = await Promise.all([
      client.from('registrations').select('id').eq('user_id', user.id).neq('status', 'rejected').limit(1).maybeSingle(),
      client.from('registrations').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'rejected'),
    ]);
    if (active.error || rejected.error) {
      console.error('/api/register/start-payment registration lookup failed:', active.error || rejected.error);
      return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 500 });
    }
    if (active.data) {
      return NextResponse.json({ error: 'You have already registered for Innovision 2026.' }, { status: 409 });
    }
    if (attemptsLeft(rejected.count ?? 0) === 0) {
      return NextResponse.json({ error: ATTEMPTS_USED_UP_ERROR }, { status: 403 });
    }

    const { data, error } = await client.rpc('start_payment_for_gender', {
      p_user_id: user.id,
      p_fresh: body.value.fresh === true,
      p_gender: gender,
    });
    if (error || !data) {
      console.error('/api/register/start-payment pass failed:', error);
      return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 500 });
    }

    if (data.state === 'female_full') {
      return NextResponse.json({ code: 'female_seats_full', error: FEMALE_SEATS_FULL_MESSAGE, field: 'gender' }, { status: 409 });
    }

    if (data.state === 'closed') {
      return NextResponse.json({ code: 'registrations_closed', error: REGISTRATIONS_FULL_MESSAGE }, { status: 409 });
    }
    return NextResponse.json({
      state: data.state,
      amount: data.amount,
      currentFee: data.current_fee ?? null,
    });
  } catch (err: unknown) {
    console.error('API /api/register/start-payment error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
