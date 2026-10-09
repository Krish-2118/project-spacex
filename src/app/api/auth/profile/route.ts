import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { isDuplicatePhoneError, PHONE_IN_USE_ERROR_MESSAGE, safeHttpUrl } from '@/lib/validation';
import { readJsonObject } from '@/lib/security';

export const runtime = 'nodejs';

const meta = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

/**
 * POST /api/auth/profile
 * Fetches or creates the CALLER's profile using server admin privileges (bypasses client RLS).
 * Identity, email and student type come from the verified access token, never from the request body.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { user, token } = auth;

    // The body is optional; when present it must be small.
    const parsed = await readJsonObject(req);
    if (!parsed.ok && parsed.status === 413) {
      return NextResponse.json({ error: parsed.error }, { status: 413 });
    }
    const body: Record<string, unknown> = parsed.ok ? parsed.value : {};

    // The body's userId (sent by older clients) must match the authenticated user.
    if (body.userId !== undefined && body.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin(token);

    // 1. Check if profile already exists
    const { data: existing, error: fetchErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (existing && !fetchErr) {
      return NextResponse.json({ success: true, profile: existing });
    }

    // 2. Derive everything from the verified auth user
    const userEmail = (user.email || '').toLowerCase();
    const isNitEmail = userEmail.endsWith('@nitrkl.ac.in');
    const md = user.user_metadata || {};

    const newProfile = {
      id: user.id,
      email: userEmail,
      full_name: meta(md.full_name, 120) || meta(md.name, 120) || userEmail.split('@')[0] || 'Explorer',
      avatar_url: safeHttpUrl(md.avatar_url) || safeHttpUrl(md.picture) || '',
      phone: meta(md.phone, 20) || meta(user.phone, 20),
      student_type: isNitEmail ? 'internal' : 'external',
      role: 'user',
      updated_at: new Date().toISOString(),
    };

    // 3. Insert only: never overwrite an existing row (and its role) with defaults.
    const insertProfile = (profile: typeof newProfile) =>
      supabase
        .from('profiles')
        .upsert(profile, { onConflict: 'id', ignoreDuplicates: true })
        .select()
        .maybeSingle();

    let { data: inserted, error: insertErr } = await insertProfile(newProfile);
    // The sign-in phone already belongs to another profile: create this one without it (the app then asks for one).
    if (isDuplicatePhoneError(insertErr)) {
      ({ data: inserted, error: insertErr } = await insertProfile({ ...newProfile, phone: null }));
    }

    if (insertErr) {
      console.error('Error in /api/auth/profile upsert:', insertErr);
      return NextResponse.json({ error: 'Failed to initialise profile' }, { status: 500 });
    }

    if (!inserted) {
      const { data: current } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      return NextResponse.json({ success: true, profile: current });
    }

    return NextResponse.json({ success: true, profile: inserted });
  } catch (err: unknown) {
    console.error('API /api/auth/profile error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/auth/profile
 * Updates the CALLER's phone number. Runs on the server so it works whenever the session cookies are valid, even if
 * the browser Supabase client has no session (its requests would then run as `anon`, which has no access to profiles).
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Your session has expired. Please log in again.' }, { status: 401 });
    }

    const parsed = await readJsonObject(req);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const rawPhone = typeof parsed.value.phone === 'string' ? parsed.value.phone : '';
    const phone = rawPhone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit Indian mobile number.' }, { status: 400 });
    }

    const { data: profile, error } = await getSupabaseAdmin(auth.token)
      .from('profiles')
      .update({ phone, updated_at: new Date().toISOString() })
      .eq('id', auth.user.id)
      .select()
      .maybeSingle();

    if (error) {
      if (isDuplicatePhoneError(error)) {
        return NextResponse.json({ error: PHONE_IN_USE_ERROR_MESSAGE }, { status: 409 });
      }
      console.error('Error in /api/auth/profile PATCH:', error);
      return NextResponse.json({ error: 'Failed to save phone number. Please try again.' }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found. Please log in again.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile });
  } catch (err: unknown) {
    console.error('API /api/auth/profile PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
