import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseConfigured, isSupabaseAdminConfigured } from '@/lib/supabase';
import { PUBLIC_EVENT_COLUMNS } from '@/lib/events';

export const runtime = 'nodejs';

// Public, unauthenticated endpoint: serve from a short in-process cache and let the CDN cache it too, so floods of
// anonymous requests don't each become a service-role database query. The CDN keeps it as long as the /events pages
// keep theirs (revalidate = 300).
const CACHE_TTL_MS = 30 * 1000;
const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=30, s-maxage=300, stale-while-revalidate=300' };
let cached: { body: unknown; expires: number } | null = null;

// Public GET route to fetch all published events
export async function GET() {
  try {
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json(cached.body, { headers: CACHE_HEADERS });
    }

    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return NextResponse.json({ success: true, events: [] }, { headers: CACHE_HEADERS });
    }

    const supabase = getSupabaseAdmin();
    const { data: events, error } = await supabase
      .from('events')
      // Public columns only: no staff user ids or storage file ids.
      .select(PUBLIC_EVENT_COLUMNS)
      .order('sort_order', { ascending: true })
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
