import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// Public GET route to fetch all published events
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({ success: true, events: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, events: events || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch events';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
