import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-server';
import { readJsonObject } from '@/lib/security';

export const runtime = 'nodejs';

/**
 * POST /api/admin/seats/accommodation  { open }
 * Admins only: whether Male students may choose accommodation (supabase/schema.sql, section 22). Reversible at any time.
 * Existing registrations don't change, and a student already quoted accommodation keeps it.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req);
    if ('error' in auth) {
      return NextResponse.json(
        { error: auth.status === 403 ? 'Only admins can change male accommodation.' : auth.error },
        { status: auth.status }
      );
    }

    const parsed = await readJsonObject(req);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    const { open } = parsed.value;
    if (typeof open !== 'boolean') {
      return NextResponse.json({ error: 'Say whether male accommodation is open.' }, { status: 400 });
    }

    const { error } = await auth.supabase
      .from('registration_counter')
      .update({
        male_accommodation_open: open,
        male_accommodation_updated_by: auth.user.id,
        male_accommodation_updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    if (error) {
      console.error('/api/admin/seats/accommodation failed:', error);
      return NextResponse.json({ error: 'Failed to change male accommodation.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('/api/admin/seats/accommodation error:', err);
    return NextResponse.json({ error: 'Failed to change male accommodation.' }, { status: 500 });
  }
}
