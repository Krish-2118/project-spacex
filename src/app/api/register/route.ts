import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getSupabase } from '@/lib/supabase';
import { isIterSoaCollege, isIterSoaEmail, ITER_SOA_ERROR_MESSAGE } from '@/lib/validation';

/**
 * Helper to authenticate user from Bearer header or cookie tokens
 */
async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : req.cookies.get('inn_access_token')?.value || null;

  let user = null;
  let authToken = token;

  if (token) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      user = data.user;
    }
  }

  // Fallback: check session from cookie if available
  if (!user) {
    const allCookies = req.cookies.getAll();
    for (const cookie of allCookies) {
      if (cookie.name.includes('-auth-token') || cookie.name === 'sb-access-token') {
        try {
          let parsedToken = cookie.value;
          if (cookie.value.startsWith('{') || cookie.value.startsWith('base64-')) {
            const decoded = cookie.value.startsWith('base64-')
              ? Buffer.from(cookie.value.slice(7), 'base64').toString('utf-8')
              : cookie.value;
            const json = JSON.parse(decoded);
            parsedToken = json.access_token || json[0]?.access_token || parsedToken;
          }
          if (parsedToken) {
            const supabase = getSupabase();
            const { data } = await supabase.auth.getUser(parsedToken);
            if (data?.user) {
              user = data.user;
              authToken = parsedToken;
              break;
            }
          }
        } catch {
          // Ignore parse errors and keep trying
        }
      }
    }
  }

  return { user, authToken };
}

/**
 * GET /api/register
 * Fetch the authenticated user's registration securely via admin client (bypasses client RLS)
 */
export async function GET(req: NextRequest) {
  try {
    const { user, authToken } = await getAuthenticatedUser(req);

    if (!user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const adminClient = getSupabaseAdmin(authToken || undefined);
    const verifiedEmail = user.email.toLowerCase().trim();

    const { data: registration, error } = await adminClient
      .from('registrations')
      .select('*')
      .or(`user_id.eq.${user.id},email.eq.${verifiedEmail}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching registration in /api/register GET:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      registration: registration || null,
    });
  } catch (err: unknown) {
    console.error('API /api/register GET error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
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
    const { user, authToken } = await getAuthenticatedUser(req);

    // STRICT AUTH GUARD
    if (!user || !user.email) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Authentication required: You must log in or sign up before registering for Innovision 2026.',
        },
        { status: 401 }
      );
    }

    // 2. Parse and Validate Form Payload
    const body = await req.json();
    const {
      name,
      college,
      phone,
      enrollment_no,
      id_card_url,
      payment_screenshot_url,
      utr,
    } = body;

    // Determine student type
    const verifiedEmail = user.email.toLowerCase().trim();
    const isInternal = verifiedEmail.endsWith('@nitrkl.ac.in');
    const studentType = isInternal ? 'internal' : 'external';

    // Mandatory fields
    if (!name || !college || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: name, college, and phone are mandatory.' },
        { status: 400 }
      );
    }

    // Exclusion rule: Students from ITER - SOA are not allowed to register
    if (!isInternal && (isIterSoaCollege(college) || isIterSoaEmail(verifiedEmail))) {
      return NextResponse.json(
        { error: ITER_SOA_ERROR_MESSAGE },
        { status: 403 }
      );
    }

    // External students require college ID card and payment proof
    if (!isInternal) {
      if (!id_card_url) {
        return NextResponse.json(
          { error: 'College ID card photo is required for external student registration.' },
          { status: 400 }
        );
      }
      if (!payment_screenshot_url) {
        return NextResponse.json(
          { error: 'Payment screenshot is required for external students.' },
          { status: 400 }
        );
      }
      if (!utr || utr.trim().length < 8) {
        return NextResponse.json(
          { error: 'A valid UPI transaction ID (UTR) is required.' },
          { status: 400 }
        );
      }
    }

    const adminClient = getSupabaseAdmin(authToken || undefined);

    // 3. Prevent duplicate registrations for the same authenticated user
    const { data: existingReg } = await adminClient
      .from('registrations')
      .select('*')
      .or(`user_id.eq.${user.id},email.eq.${verifiedEmail}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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

    // 4. Status and Fee Logic:
    // Internal students: ₹0 fee, auto-CONFIRMED, no ID card or approval required!
    // External students: ₹499 fee, pending review by IT-Team.
    const status = isInternal ? 'confirmed' : 'pending';
    const amount = isInternal ? 0 : 499;

    // Generate unique Registration ID: IV26-XXXX
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const registration_id = `IV26-${randomDigits}`;

    // 5. Insert Registration into Database
    const regPayload = {
      registration_id,
      user_id: user.id,
      name: name.trim(),
      email: verifiedEmail,
      college: isInternal ? 'National Institute of Technology Rourkela' : college.trim(),
      phone: phone.trim(),
      enrollment_no: enrollment_no ? enrollment_no.trim() : null,
      student_type: studentType,
      id_card_url: isInternal ? (id_card_url || null) : id_card_url,
      payment_screenshot_url: isInternal ? null : payment_screenshot_url,
      utr: isInternal ? null : (utr || '').trim(),
      amount,
      status,
    };

    const { data: newReg, error: regError } = await adminClient
      .from('registrations')
      .insert(regPayload)
      .select()
      .single();

    if (regError) {
      console.error('Error inserting registration:', regError);
      return NextResponse.json(
        { error: regError.message || 'Failed to record registration.' },
        { status: 500 }
      );
    }

    // Update profile with enrollment_no & phone
    await adminClient
      .from('profiles')
      .update({
        phone: phone.trim(),
        enrollment_no: enrollment_no ? enrollment_no.trim() : null,
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
    const message = err instanceof Error ? err.message : 'Internal server error processing registration.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
