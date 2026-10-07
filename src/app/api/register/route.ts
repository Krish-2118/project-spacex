import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { paymentProofExists } from '@/lib/payment-proofs';
import { isIterSoaCollege, isIterSoaEmail, ITER_SOA_ERROR_MESSAGE } from '@/lib/validation';
import {
  createRateLimiter,
  generateRegistrationId,
  isFilterSafeEmail,
  readJsonObject,
  validateRegistrationInput,
} from '@/lib/security';

const registerLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 });

/** Latest registration owned by this user (by id, or by their verified email for legacy rows). */
async function findExistingRegistration(client: SupabaseClient, user: User, verifiedEmail: string) {
  const filter = isFilterSafeEmail(verifiedEmail)
    ? `user_id.eq.${user.id},email.eq.${verifiedEmail}`
    : `user_id.eq.${user.id}`;
  return client
    .from('registrations')
    .select('*')
    .or(filter)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
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

    return NextResponse.json({
      success: true,
      registration: registration || null,
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

    if (!registerLimiter.hit(user.id)) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please wait a few minutes and try again.' },
        { status: 429 }
      );
    }

    // Determine student type from the identity provider's verified email, never from the request body.
    const verifiedEmail = user.email!.toLowerCase().trim();
    const isInternal = verifiedEmail.endsWith('@nitrkl.ac.in');
    const studentType = isInternal ? 'internal' : 'external';

    // The free, auto-confirmed internal tier is only for addresses the identity provider has verified.
    if (isInternal && !user.email_confirmed_at) {
      return NextResponse.json(
        { error: 'Please verify your @nitrkl.ac.in email address before registering.' },
        { status: 403 }
      );
    }

    // 2. Parse and Validate Form Payload
    const body = await readJsonObject(req);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }

    // ownerId comes from the verified session: a payment proof path is only accepted inside this user's own folder.
    const parsed = validateRegistrationInput(body.value, {
      isInternal,
      ownerId: user.id,
    });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const input = parsed.data;

    // Exclusion rule: Students from ITER - SOA are not allowed to register
    if (!isInternal && (isIterSoaCollege(input.college) || isIterSoaEmail(verifiedEmail))) {
      return NextResponse.json(
        { error: ITER_SOA_ERROR_MESSAGE },
        { status: 403 }
      );
    }

    const adminClient = getSupabaseAdmin(token);

    // 3. Prevent duplicate registrations for the same authenticated user
    const { data: existingReg } = await findExistingRegistration(adminClient, user, verifiedEmail);

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

    // A UPI transaction can only pay for one registration.
    if (input.utr) {
      const { data: utrOwner } = await adminClient
        .from('registrations')
        .select('id')
        .eq('utr', input.utr)
        .neq('status', 'rejected')
        .limit(1)
        .maybeSingle();
      if (utrOwner) {
        return NextResponse.json(
          { error: 'This UPI transaction ID (UTR) has already been used for another registration.' },
          { status: 409 }
        );
      }
    }

    // The proof must be an object this user actually uploaded (checked with their own token, so Storage RLS only
    // lets them see their own folder).
    if (input.payment_proof_path && !(await paymentProofExists(token, input.payment_proof_path))) {
      return NextResponse.json(
        { error: 'Payment screenshot not found. Please re-upload your screenshot.' },
        { status: 400 }
      );
    }

    // 4. Status and Fee Logic:
    // Internal students: ₹0 fee, auto-CONFIRMED, no payment or approval required!
    // External students: ₹499 fee, pending review by IT-Team.
    const status = isInternal ? 'confirmed' : 'pending';
    const amount = isInternal ? 0 : 499;

    // 5. Insert Registration into Database (retrying if the random IV26-XXXX id collides)
    const basePayload = {
      user_id: user.id,
      name: input.name,
      email: verifiedEmail,
      college: isInternal ? 'National Institute of Technology Rourkela' : input.college,
      phone: input.phone,
      enrollment_no: input.enrollment_no,
      gender: input.gender,
      student_type: studentType,
      // Only the private storage object path is stored, never a URL or the image itself.
      payment_proof_path: input.payment_proof_path,
      utr: input.utr,
      amount,
      status,
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
      if (regError.code !== '23505') break;
      // Unique violation on utr: another registration claimed this UTR between the pre-check and the insert.
      if (/utr/i.test(`${regError.message} ${regError.details ?? ''}`)) {
        return NextResponse.json(
          { error: 'This UPI transaction ID (UTR) has already been used for another registration.' },
          { status: 409 }
        );
      }
      // Unique violation on user_id (concurrent double submit): return the registration that won.
      if (!/registration_id/i.test(`${regError.message} ${regError.details ?? ''}`)) {
        const { data: winner } = await findExistingRegistration(adminClient, user, verifiedEmail);
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
      message: isInternal
        ? 'Registration confirmed for NIT Rourkela student!'
        : 'Registration submitted successfully. Pending verification.',
      registration: newReg,
    });
  } catch (err: unknown) {
    console.error('Registration API error:', err);
    return NextResponse.json(
      { error: 'Internal server error processing registration.' },
      { status: 500 }
    );
  }
}
