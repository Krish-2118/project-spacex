import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * POST /api/auth/profile
 * Safely fetches or creates a user profile using server admin privileges (bypasses client RLS).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, email, fullName, avatarUrl, phone, studentType } = body;

    const token =
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      req.cookies.get('inn_access_token')?.value;

    const supabase = getSupabaseAdmin(token || undefined);

    const uid = userId;
    if (!uid) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // 1. Check if profile already exists
    const { data: existing, error: fetchErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (existing && !fetchErr) {
      return NextResponse.json({ success: true, profile: existing });
    }

    // 2. Derive student type from email if not provided
    const userEmail = email || '';
    const isNitEmail = userEmail.toLowerCase().endsWith('@nitrkl.ac.in');
    const computedStudentType = studentType || (isNitEmail ? 'internal' : 'external');
    const computedName = fullName || userEmail.split('@')[0] || 'Explorer';

    const newProfile = {
      id: uid,
      email: userEmail,
      full_name: computedName,
      avatar_url: avatarUrl || '',
      phone: phone || null,
      student_type: computedStudentType,
      role: 'user',
      updated_at: new Date().toISOString(),
    };

    // 3. Upsert profile with admin client (immune to client-side RLS 42501)
    const { data: inserted, error: insertErr } = await supabase
      .from('profiles')
      .upsert(newProfile, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (insertErr) {
      console.error('Error in /api/auth/profile upsert:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: inserted });
  } catch (err: unknown) {
    console.error('API /api/auth/profile error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
