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

async function verifyAdmin(req: NextRequest) {
  const staff = await verifyStaff(req);
  if ('error' in staff) return staff;

  if (staff.role !== 'admin') {
    return { error: 'Forbidden: Superadmin access required to modify user roles', status: 403 };
  }

  return staff;
}

// GET all users (Admin only: IT Team cannot access user directory)
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabase } = auth;
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, users: users || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch users';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// PATCH change user role (Admin only)
// Rules:
// 1. One admin cannot change the role of another admin.
// 2. Admin role can only be changed from the database only (cannot assign 'admin' role via API).
export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json({ error: 'Missing userId or role' }, { status: 400 });
    }

    // Rule: Admin role can only be changed from the database only!
    if (role === 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin role can only be assigned directly in the database.' },
        { status: 403 }
      );
    }

    // Allowed roles to be assigned via the web dashboard: only 'user' or 'it-team'
    const assignableRoles = ['user', 'it-team'];
    if (!assignableRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Only "user" and "it-team" can be assigned via the dashboard. Admin roles must be set directly in the database.' },
        { status: 400 }
      );
    }

    const { supabase } = auth;

    // Fetch target user to check their current role
    const { data: targetProfile, error: targetErr } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .maybeSingle();

    if (targetErr || !targetProfile) {
      return NextResponse.json({ error: 'Target user profile not found' }, { status: 404 });
    }

    // Rule: One admin cannot change the role of another admin. Admin role can only be changed from the database only.
    if (targetProfile.role === 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Cannot change the role of an Administrator. Admin roles can only be modified directly in the database.' },
        { status: 403 }
      );
    }

    // Target user profile verified as non-admin -> execute role change to 'user' or 'it-team'
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update user role';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
