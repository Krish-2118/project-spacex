import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

async function verifyStaff(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  let token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    token = req.cookies.get('inn_access_token')?.value;
  }

  if (!token) {
    return { error: 'Unauthorized: Missing auth token', status: 401 };
  }

  const supabase = getSupabaseAdmin(token);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);

  if (authErr || !user) {
    return { error: 'Unauthorized: Invalid token', status: 401 };
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profErr || !profile || !['admin', 'it-team'].includes(profile.role)) {
    return { error: 'Forbidden: Admin or IT-Team access required', status: 403 };
  }

  return { user, role: profile.role, supabase };
}

async function verifyAdmin(req: NextRequest) {
  const staff = await verifyStaff(req);
  if ('error' in staff) return staff;

  if (staff.role !== 'admin') {
    return { error: 'Forbidden: Superadmin access required to modify user roles', status: 403 };
  }

  return staff;
}

// GET all users (Staff: Admin & IT-Team)
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyStaff(req);
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

    const validRoles = ['user', 'it-team', 'admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 });
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

    // Target user profile verified
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
