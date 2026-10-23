import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyAdmin, verifyRegistrationStaff } from '@/lib/auth-server';
import { readJsonObject } from '@/lib/security';
import { seatCountError } from '@/lib/seats';

export const runtime = 'nodejs';

/** The counter as staff see it: the two numbers, and who last set them by hand and when. */
async function readCounter(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('registration_counter')
    .select('total_seats, seats_left, updated_by, updated_at')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) return { error: error ?? new Error('registration_counter has no row'), counter: null };

  let updatedBy: string | null = null;
  if (data.updated_by) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', data.updated_by)
      .maybeSingle();
    updatedBy = profile?.full_name || profile?.email || null;
  }
  return {
    error: null,
    counter: { total: data.total_seats, left: data.seats_left, updatedAt: data.updated_at, updatedBy },
  };
}

const UNAVAILABLE =
  'The seat counter is not set up yet. Run supabase/manual/seat_counter_and_reregistration.sql in Supabase.';

/**
 * GET /api/admin/seats
 * The seat counter for the admin dashboard (admins and the registration team).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyRegistrationStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { error, counter } = await readCounter(auth.supabase);
    if (error) {
      console.error('/api/admin/seats read failed:', error);
      return NextResponse.json({ error: UNAVAILABLE }, { status: 500 });
    }
    return NextResponse.json({ success: true, counter });
  } catch (err: unknown) {
    console.error('/api/admin/seats GET error:', err);
    return NextResponse.json({ error: 'Failed to load the seat counter' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/seats  { total, left }
 * Admins only: sets both numbers. The database keeps moving `left` from there as registrations come in and are
 * rejected.
 */
export async function PATCH(req: NextRequest) {
  try {
    // verifyAdmin's 403 message is about user roles; a refusal here says what this route needs instead.
    const auth = await verifyAdmin(req);
    if ('error' in auth) {
      return NextResponse.json(
        { error: auth.status === 403 ? 'Only admins can change the seat counter.' : auth.error },
        { status: auth.status }
      );
    }

    const parsed = await readJsonObject(req);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    const { total, left } = parsed.value;
    const invalid = seatCountError(total, left);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const { error: writeError } = await auth.supabase
      .from('registration_counter')
      .upsert(
        { id: 1, total_seats: total, seats_left: left, updated_by: auth.user.id, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
    if (writeError) {
      console.error('/api/admin/seats write failed:', writeError);
      return NextResponse.json({ error: UNAVAILABLE }, { status: 500 });
    }

    const { error, counter } = await readCounter(auth.supabase);
    if (error) {
      console.error('/api/admin/seats read after write failed:', error);
      return NextResponse.json({ error: 'Saved, but the new counter could not be read back. Refresh.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, counter });
  } catch (err: unknown) {
    console.error('/api/admin/seats PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update the seat counter' }, { status: 500 });
  }
}
