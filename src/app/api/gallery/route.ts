import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// Public GET route to fetch all gallery photos
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: gallery, error } = await supabase
      .from('gallery')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({ success: true, gallery: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, gallery: gallery || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch gallery images';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
