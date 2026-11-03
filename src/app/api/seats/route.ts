import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase';

export const runtime = 'nodejs';

// Public, unauthenticated endpoint polled by every open registration form: serve from a short in-process cache and let
// the CDN cache it too, so a crowd watching the counter doesn't turn into one database query each. Short enough that
// the number still visibly moves while someone is on the form. Display only: POST /api/register/start-payment reads the
// database live to decide who may pay. Excluded from the global no-store API header in next.config.ts.
const CACHE_TTL_MS = 5 * 1000;
const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=5, s-maxage=5, stale-while-revalidate=10' };
const NO_STORE = { 'Cache-Control': 'no-store' };
let cached: { body: { total: number; left: number; closed: boolean; femaleFull: boolean }; expires: number } | null = null;

/**
 * GET /api/seats
 * The seat counter on the registration form: { total, left, closed, femaleFull } (supabase/schema.sql, sections 17, 20
 * and 21). Only these, nothing about any registration. 503 while the counter isn't set up: the form then hides it.
 */
export async function GET() {
  try {
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json(cached.body, { headers: CACHE_HEADERS });
    }
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Seat counter unavailable' }, { status: 503, headers: NO_STORE });
    }

    const client = getSupabaseAdmin();
    const [{ data, error }, female] = await Promise.all([
      client.from('registration_counter').select('total_seats, seats_left, closed_at').eq('id', 1).maybeSingle(),
      client.rpc('female_seats_status'),
    ]);
    if (error || !data) {
      if (error) console.error('Seat counter query failed:', error);
      return NextResponse.json({ error: 'Seat counter unavailable' }, { status: 503, headers: NO_STORE });
    }
    // Display only: a failed lookup leaves the options open, and start-payment and the database still enforce the cap.
    if (female.error) console.error('Female seats query failed:', female.error);

    const body = {
      total: data.total_seats,
      left: data.seats_left,
      closed: data.closed_at !== null,
      femaleFull: female.data?.full === true,
    };
    cached = { body, expires: Date.now() + CACHE_TTL_MS };
    return NextResponse.json(body, { headers: CACHE_HEADERS });
  } catch (err: unknown) {
    console.error('Seat counter route error:', err);
    return NextResponse.json({ error: 'Seat counter unavailable' }, { status: 503, headers: NO_STORE });
  }
}
