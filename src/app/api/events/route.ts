import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// Public, unauthenticated endpoint: serve from a short in-process cache and let the CDN cache it too, so floods of
// anonymous requests don't each become a service-role database query.
const CACHE_TTL_MS = 30 * 1000;
const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300' };
let cached: { body: unknown; expires: number } | null = null;

// Public GET route to fetch all published events
export async function GET() {
  try {
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json(cached.body, { headers: CACHE_HEADERS });
    }

    const supabase = getSupabaseAdmin();
    const { data: events, error } = await supabase
      .from('events')
      // Public columns only: no staff user ids or storage file ids.
      .select('id, title, description, poster_url, brochure_url, category, format, duration, venue, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({ success: true, events: [] });
      }
      console.error('Public events query failed:', error);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    const body = { success: true, events: events || [] };
    cached = { body, expires: Date.now() + CACHE_TTL_MS };
    return NextResponse.json(body, { headers: CACHE_HEADERS });
  } catch (err: unknown) {
    console.error('Public events route error:', err);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
