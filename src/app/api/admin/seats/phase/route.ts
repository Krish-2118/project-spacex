import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-server';
import { readJsonObject } from '@/lib/security';
import { nextPhaseError } from '@/lib/seats';

export const runtime = 'nodejs';

/**
 * POST /api/admin/seats/phase  { fee, total, left }
 * Admins only: starts the next registration phase, the only way to reopen registrations (start_registration_phase,
 * supabase/schema.sql section 20). Refused while a phase is open. Students already quoted an older fee keep it.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req);
    if ('error' in auth) {
      return NextResponse.json(
        { error: auth.status === 403 ? 'Only admins can start a registration phase.' : auth.error },
        { status: auth.status }
      );
    }

    const parsed = await readJsonObject(req);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    const { fee, total, left } = parsed.value;
    const invalid = nextPhaseError(fee, total, left);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const { error } = await auth.supabase.rpc('start_registration_phase', {
      p_fee: fee,
      p_total: total,
      p_left: left,
      p_admin: auth.user.id,
    });
    if (error) {
      // 55000: the current phase hasn't closed (trg_close_registration_phase_at_zero closes it at 0).
      if (error.code === '55000') {
        return NextResponse.json(
          { error: 'The current phase is still open. Set seats left to 0 to close it first.' },
          { status: 409 }
        );
      }
      console.error('/api/admin/seats/phase failed:', error);
      return NextResponse.json({ error: 'Failed to start the next phase.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('/api/admin/seats/phase error:', err);
    return NextResponse.json({ error: 'Failed to start the next phase.' }, { status: 500 });
  }
}
