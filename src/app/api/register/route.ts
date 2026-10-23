import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { paymentProofExists } from '@/lib/payment-proofs';
import { ambassadorGuardError, findOwnAmbassador, resolveReferralCode, type Registrant } from '@/lib/ambassadors';
import { registrationsClosedResponse, registrationsOpen } from '@/lib/registration-gate';
import { isDuplicatePhoneError, PHONE_IN_USE_ERROR_MESSAGE } from '@/lib/validation';
import { ATTEMPTS_USED_UP_ERROR, attemptsLeft, isAttemptsUsedUpError } from '@/lib/rejections';
import {
  classifyStudentType,
  createRateLimiter,
  generateRegistrationId,
  isFilterSafeEmail,
  NEW_REGISTRATION_STATUS,
  readJsonObject,
  REGISTRATION_FEE_INR,
  validateRegistrationInput,
} from '@/lib/security';

const registerLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 });

/** Added to a referral-code error at submit: the form goes back to the code with the payment details still filled in. */
const PAYMENT_KEPT_NOTE = 'Nothing was submitted and your payment details are kept: fix or clear the code, then submit again.';

/**
 * Latest registration owned by this user (by id, or by their verified email for legacy rows). `activeOnly` leaves out
 * rejected ones: a rejected registration doesn't stop the user from registering again.
 */
async function findExistingRegistration(
  client: SupabaseClient,
  user: User,
  verifiedEmail: string,
  { activeOnly = false } = {}
) {
  const filter = isFilterSafeEmail(verifiedEmail)
    ? `user_id.eq.${user.id},email.eq.${verifiedEmail}`
    : `user_id.eq.${user.id}`;
  let query = client.from('registrations').select('*').or(filter);
  if (activeOnly) query = query.neq('status', 'rejected');
  return query.order('created_at', { ascending: false }).limit(1).maybeSingle();
}

/** How many of this user's registrations staff rejected (each one uses up an attempt). */
async function countRejected(client: SupabaseClient, userId: string) {
  const { count, error } = await client
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'rejected');
  return { count: count ?? 0, error };
}

/**
 * The registration as the registrant sees it: for an active campus ambassador, ambassador_code is their CA code, which
 * the pass shows instead of the registration's own 6-character referral_code (it stays valid whatever happens to the
 * registration). Not a column. A failed lookup only leaves it out.
 */
async function withAmbassadorCode<T extends object>(client: SupabaseClient, registration: T, registrant: Registrant) {
  const { ambassador, error } = await findOwnAmbassador(client, registrant);
  if (error) console.warn('Own ambassador lookup failed:', error);
  return { ...registration, ambassador_code: ambassador?.status === 'active' ? ambassador.code : null };
}

/**
 * Answer to a UTR that's already taken. A retry whose first attempt was saved (but whose response was lost) also
 * lands here, so first look for the caller's OWN registration, by the verified session user id only: a matching UTR
 * alone never proves who registered. Otherwise the UTR belongs to someone else: 409, without any of their details.
 */
async function utrConflictResponse(client: SupabaseClient, userId: string) {
  const { data: own, error } = await client
    .from('registrations')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'rejected')
    .limit(1)
    .maybeSingle();
  if (error) console.warn('Registration lookup after a UTR conflict failed:', error);
  if (own) {
    return NextResponse.json({
      success: true,
      alreadyRegistered: true,
      message: 'You have already registered for Innovision 2026.',
      registration: own,
    });
  }
  return NextResponse.json(
    { error: 'This UPI transaction ID (UTR) has already been used for another registration.', field: 'utr' },
    { status: 409 }
  );
}

/**
 * GET /api/register
 * Fetch the authenticated user's registration securely via admin client (bypasses client RLS)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);

    if (!auth || !auth.user.email) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { user, token } = auth;
    const adminClient = getSupabaseAdmin(token);
    const verifiedEmail = user.email!.toLowerCase().trim();

    const { data: registration, error } = await findExistingRegistration(adminClient, user, verifiedEmail);

    if (error) {
      console.warn('Error fetching registration in /api/register GET:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch registration.' }, { status: 500 });
    }
    if (!registration) return NextResponse.json({ success: true, registration: null });

    // A rejected registration also says whether the user may register again (the pass shows REGISTER AGAIN).
    let extra = {};
    if (registration.status === 'rejected') {
      const rejected = await countRejected(adminClient, user.id);
      if (rejected.error) {
        console.warn('Rejected registrations count failed in /api/register GET:', rejected.error);
        return NextResponse.json({ success: false, error: 'Failed to fetch registration.' }, { status: 500 });
      }
      extra = { attempts_left: attemptsLeft(rejected.count) };
    }

    return NextResponse.json({
      success: true,
      registration: await withAmbassadorCode(
        adminClient,
        { ...registration, ...extra },
        { userId: user.id, email: verifiedEmail }
      ),
    });
  } catch (err: unknown) {
    console.error('API /api/register GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/register
 * Authenticated API Endpoint for Event Registration.
 * Protected by Auth Middleware: No unauthenticated requests are permitted.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Request
    const auth = await getAuthenticatedUser(req);

    // STRICT AUTH GUARD
    if (!auth || !auth.user.email) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Authentication required: You must log in or sign up before registering for Innovision 2026.',
        },
        { status: 401 }
      );
    }
    const { user, token } = auth;

    // Server-side closure: before the rate limiter, the body and any database or Storage call.
    if (!registrationsOpen()) return registrationsClosedResponse();

    if (!registerLimiter.hit(user.id)) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(registerLimiter.retryAfterSeconds(user.id)) } }
      );
    }

    // Student type is a reporting label from the identity provider's verified email, never from the request body.
    // It does not change the fee, the status or what has to be submitted: every registration is paid and reviewed.
    const verifiedEmail = user.email!.toLowerCase().trim();
    const studentType = classifyStudentType(verifiedEmail, !!user.email_confirmed_at);

    // 2. Parse and Validate Form Payload
    const body = await readJsonObject(req);
    if (!body.ok) {
      return NextResponse.json({ error: body.error, field: 'form' }, { status: body.status });
    }

    // ownerId comes from the verified session: a payment proof path is only accepted inside this user's own folder.
    const parsed = validateRegistrationInput(body.value, { ownerId: user.id });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });
    }
    const input = parsed.data;
    const college = input.college;

    const adminClient = getSupabaseAdmin(token);

    // 3. Prevent duplicate registrations for the same authenticated user. A rejected one doesn't count: the user may
    // register again, up to MAX_REGISTRATION_ATTEMPTS registrations in all (also enforced by the database).
    const { data: existingReg } = await findExistingRegistration(adminClient, user, verifiedEmail, { activeOnly: true });

    if (existingReg) {
      return NextResponse.json(
        {
          success: true,
          alreadyRegistered: true,
          message: 'You have already registered for Innovision 2026.',
          registration: existingReg,
        },
        { status: 200 }
      );
    }

    const rejected = await countRejected(adminClient, user.id);
    if (rejected.error) {
      console.error('Rejected registrations count failed in /api/register POST:', rejected.error);
      return NextResponse.json({ error: 'Failed to record registration. Please try again.' }, { status: 500 });
    }
    if (attemptsLeft(rejected.count) === 0) {
      return NextResponse.json({ error: ATTEMPTS_USED_UP_ERROR }, { status: 403 });
    }

    // A UPI transaction can only pay for one registration.
    const { data: utrOwner } = await adminClient
      .from('registrations')
      .select('id')
      .eq('utr', input.utr)
      .neq('status', 'rejected')
      .limit(1)
      .maybeSingle();
    if (utrOwner) return utrConflictResponse(adminClient, user.id);

    // The proof (required for everyone) must be an object this user actually uploaded (checked with their own token,
    // so Storage RLS only lets them see their own folder).
    if (!(await paymentProofExists(token, input.payment_proof_path))) {
      return NextResponse.json(
        { error: 'Payment screenshot not found. Please re-upload your screenshot.', field: 'payfile' },
        { status: 400 }
      );
    }

    // Optional referral: a registrant's code (a registration that wasn't rejected) or an active campus ambassador's
    // code that isn't the registrant's own (src/lib/ambassadors.ts). Checked last, after the UTR and proof. The form
    // checks the code before payment (POST /api/register/check-code); a code that went bad since (an ambassador revoked
    // in between) refuses the whole submit, so nothing is saved without the credit the registrant meant to give. The
    // UTR is only claimed when the row is written, so the same payment details can be submitted again straight away.
    const registrant: Registrant = { userId: user.id, email: verifiedEmail };
    let referredBy: string | null = null;
    let ambassadorId: string | null = null;
    if (input.referred_by_code) {
      const referral = await resolveReferralCode(adminClient, input.referred_by_code, registrant);
      if (!referral.ok) {
        return NextResponse.json(
          referral.status === 400
            ? { error: `${referral.error} ${PAYMENT_KEPT_NOTE}`, field: 'referred_by_code' }
            : { error: referral.error },
          { status: referral.status }
        );
      }
      referredBy = referral.referredBy;
      ambassadorId = referral.ambassadorId;
    }

    // 4. Status and fee are server constants, the same for every registrant (no free tier): any status, amount or
    // student_type in the body is ignored. Staff confirm or reject after checking the payment.
    // 5. Insert Registration into Database (retrying if the random IV26-XXXX id or the generated referral code collides)
    const basePayload = {
      user_id: user.id,
      name: input.name,
      email: verifiedEmail,
      college,
      phone: input.phone,
      enrollment_no: input.enrollment_no,
      gender: input.gender,
      student_type: studentType,
      // Only the private storage object path is stored, never a URL or the image itself.
      payment_proof_path: input.payment_proof_path,
      utr: input.utr,
      amount: REGISTRATION_FEE_INR,
      status: NEW_REGISTRATION_STATUS,
      // The registrant's own referral_code is generated by the database (trg_assign_referral_code).
      referred_by: referredBy,
      // Only sent when an ambassador's code was used, so registering without one keeps working on a database that
      // hasn't had supabase/manual/add_campus_ambassadors.sql yet.
      ...(ambassadorId ? { ambassador_id: ambassadorId } : {}),
    };

    let newReg = null;
    let regError = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const result = await adminClient
        .from('registrations')
        .insert({ ...basePayload, registration_id: generateRegistrationId() })
        .select()
        .single();
      newReg = result.data;
      regError = result.error;
      if (!regError) break;
      // The ambassador was revoked between the check above and this insert (trg_guard_registration_ambassador).
      const guardError = ambassadorGuardError(regError);
      if (guardError) {
        return NextResponse.json({ error: `${guardError} ${PAYMENT_KEPT_NOTE}`, field: 'referred_by_code' }, { status: 400 });
      }
      // Rejected for the last time between the check above and this insert (trg_guard_registration_attempts).
      if (isAttemptsUsedUpError(regError)) {
        return NextResponse.json({ error: ATTEMPTS_USED_UP_ERROR }, { status: 403 });
      }
      if (regError.code !== '23505') break;
      // Unique violation on utr: another registration claimed this UTR between the pre-check and the insert (possibly
      // this user's own concurrent submit, when the UTR index is checked before the user_id index).
      if (/utr/i.test(`${regError.message} ${regError.details ?? ''}`)) {
        return utrConflictResponse(adminClient, user.id);
      }
      if (isDuplicatePhoneError(regError)) {
        return NextResponse.json({ error: PHONE_IN_USE_ERROR_MESSAGE, field: 'phone' }, { status: 409 });
      }
      // Unique violation on user_id (concurrent double submit): return the registration that won.
      if (!/registration_id|referral_code/i.test(`${regError.message} ${regError.details ?? ''}`)) {
        const { data: winner } = await findExistingRegistration(adminClient, user, verifiedEmail, { activeOnly: true });
        if (winner) {
          return NextResponse.json({
            success: true,
            alreadyRegistered: true,
            message: 'You have already registered for Innovision 2026.',
            registration: winner,
          });
        }
        break;
      }
    }

    if (regError || !newReg) {
      console.error('Error inserting registration:', regError);
      return NextResponse.json(
        { error: 'Failed to record registration. Please try again.' },
        { status: 500 }
      );
    }

    // Update profile with enrollment_no & phone
    await adminClient
      .from('profiles')
      .update({
        phone: input.phone,
        enrollment_no: input.enrollment_no,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      message: 'Registration submitted successfully. Pending verification.',
      registration: await withAmbassadorCode(adminClient, newReg, registrant),
    });
  } catch (err: unknown) {
    console.error('Registration API error:', err);
    return NextResponse.json(
      { error: 'Internal server error processing registration.' },
      { status: 500 }
    );
  }
}
