import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// Public, unauthenticated endpoint: serve from a short in-process cache and let the CDN cache it too, so floods of
// anonymous requests don't each become a service-role database query.
const CACHE_TTL_MS = 30 * 1000;
const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300' };
let cached: { body: unknown; expires: number } | null = null;

// Public GET route to fetch all gallery photos
export async function GET() {
  try {
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json(cached.body, { headers: CACHE_HEADERS });
    }

    const supabase = getSupabaseAdmin();
    const { data: gallery, error } = await supabase
      .from('gallery')
      // Public columns only: no staff user ids or storage file ids.
      .select('id, title, image_url, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({ success: true, gallery: [] });
      }
      console.error('Public gallery query failed:', error);
      return NextResponse.json({ error: 'Failed to fetch gallery' }, { status: 500 });
    }

    const body = { success: true, gallery: gallery || [] };
    cached = { body, expires: Date.now() + CACHE_TTL_MS };
    return NextResponse.json(body, { headers: CACHE_HEADERS });
  } catch (err: unknown) {
    console.error('Public gallery route error:', err);
    return NextResponse.json({ error: 'Failed to fetch gallery images' }, { status: 500 });
  }
}
