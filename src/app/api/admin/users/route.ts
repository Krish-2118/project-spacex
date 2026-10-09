import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-server';
import { isUuid, readJsonObject } from '@/lib/security';

export const runtime = 'nodejs';

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
      console.error('/api/admin/users database error:', error);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, users: users || [] });
  } catch (err: unknown) {
    console.error('/api/admin/users error:', err);
    const message = 'Failed to fetch users';
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

    const parsed = await readJsonObject(req);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { userId, role } = parsed.value;

    if (!userId || !role) {
      return NextResponse.json({ error: 'Missing userId or role' }, { status: 400 });
    }

    if (!isUuid(userId)) {
      return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    // Rule: Admin role can only be changed from the database only!
    if (role === 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin role can only be assigned directly in the database.' },
        { status: 403 }
      );
    }

    // Allowed roles to be assigned via the web dashboard: only 'user', 'it-team', or 'registration-team'
    const assignableRoles = ['user', 'it-team', 'registration-team'];
    if (typeof role !== 'string' || !assignableRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Only "user", "it-team", and "registration-team" can be assigned via the dashboard. Admin roles must be set directly in the database.' },
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

    // Target user profile verified as non-admin -> execute role change to 'user', 'it-team', or 'registration-team'
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('/api/admin/users database error:', error);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (err: unknown) {
    console.error('/api/admin/users error:', err);
    const message = 'Failed to update user role';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
