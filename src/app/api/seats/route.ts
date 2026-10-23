import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase';

export const runtime = 'nodejs';

// Public, unauthenticated endpoint polled by every open registration form: serve from a short in-process cache and let
// the CDN cache it too, so a crowd watching the counter doesn't turn into one database query each. Short enough that
// the number still visibly moves while someone is on the form. Excluded from the global no-store API header in
// next.config.ts.
const CACHE_TTL_MS = 10 * 1000;
const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=10, s-maxage=15, stale-while-revalidate=30' };
const NO_STORE = { 'Cache-Control': 'no-store' };
let cached: { body: { total: number; left: number }; expires: number } | null = null;

/**
 * GET /api/seats
 * The seat counter on the registration form: { total, left } (supabase/schema.sql, section 17). Only these two numbers,
 * nothing about any registration. 503 while the counter isn't set up: the form then hides it.
 */
export async function GET() {
  try {
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json(cached.body, { headers: CACHE_HEADERS });
    }
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Seat counter unavailable' }, { status: 503, headers: NO_STORE });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('registration_counter')
      .select('total_seats, seats_left')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) {
      if (error) console.error('Seat counter query failed:', error);
      return NextResponse.json({ error: 'Seat counter unavailable' }, { status: 503, headers: NO_STORE });
    }

    const body = { total: data.total_seats, left: data.seats_left };
    cached = { body, expires: Date.now() + CACHE_TTL_MS };
    return NextResponse.json(body, { headers: CACHE_HEADERS });
  } catch (err: unknown) {
    console.error('Seat counter route error:', err);
    return NextResponse.json({ error: 'Seat counter unavailable' }, { status: 503, headers: NO_STORE });
  }
}
