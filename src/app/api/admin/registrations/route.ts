import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

async function verifyStaff(req: NextRequest) {
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
  let activeUser = null;

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
    return { error: 'Forbidden: Admin or IT-Team access required', status: 403 };
  }

  return { user: activeUser, role: profile.role, supabase };
}

// GET all registrations (with optional filtering)
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabase } = auth;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const studentType = searchParams.get('student_type');
    const query = searchParams.get('q');

    let dbQuery = supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      dbQuery = dbQuery.eq('status', status);
    }

    if (studentType && studentType !== 'all') {
      dbQuery = dbQuery.eq('student_type', studentType);
    }

    if (query) {
      dbQuery = dbQuery.or(
        `name.ilike.%${query}%,email.ilike.%${query}%,registration_id.ilike.%${query}%,college.ilike.%${query}%,utr.ilike.%${query}%,enrollment_no.ilike.%${query}%`
      );
    }

    const { data: registrations, error } = await dbQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, registrations: registrations || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch registrations';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// PATCH approve or reject registration ("once done cannot be altered")
export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { registrationId, status } = body;

    if (!registrationId || !status) {
      return NextResponse.json(
        { error: 'Missing registrationId or status' },
        { status: 400 }
      );
    }

    if (!['confirmed', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'confirmed' or 'rejected'" },
        { status: 400 }
      );
    }

    const { supabase, user } = auth;

    // Fetch existing registration to verify status
    const { data: existing, error: fetchErr } = await supabase
      .from('registrations')
      .select('id, status, registration_id')
      .eq('id', registrationId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // STRICT RULE: Once done cannot be altered!
    if (existing.status !== 'pending') {
      return NextResponse.json(
        {
          error: `Registration ${existing.registration_id} is already ${existing.status.toUpperCase()} and cannot be altered.`,
        },
        { status: 400 }
      );
    }

    const { data: updated, error: updateErr } = await supabase
      .from('registrations')
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .select()
      .maybeSingle();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, registration: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update registration status';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
