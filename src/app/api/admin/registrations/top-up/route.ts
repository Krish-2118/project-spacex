import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationStaff } from '@/lib/auth-server';
import { isUuid, readJsonObject } from '@/lib/security';
import { isFee, MAX_FEE } from '@/lib/seats';

export const runtime = 'nodejs';

const UTR_TAKEN = 'That UTR is already used by another registration or top-up.';

/**
 * POST /api/admin/registrations/top-up
 *   { registrationId, action: 'ask', amountDue }   Asks for the rest of the fee: MY PASS shows it, approval is blocked.
 *   { registrationId, action: 'record', utr }      The rest has arrived: stores its UTR, approval is possible again.
 * Registration-Team/Admin only, on a pending registration that isn't the caller's own. For someone who paid too little:
 * payments can't be refunded, so they pay the difference instead of the whole fee again. `amount` already holds the full
 * fee owed and doesn't change.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyRegistrationStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = await readJsonObject(req);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    const { registrationId, action, amountDue, utr } = parsed.value;
    if (!isUuid(registrationId)) {
      return NextResponse.json({ error: 'Invalid registrationId' }, { status: 400 });
    }

    const { supabase, user } = auth;
    const { data: existing, error: fetchErr } = await supabase
      .from('registrations')
      .select('id, user_id, registration_id, status, amount_due')
      .eq('id', registrationId)
      .maybeSingle();
    if (fetchErr) {
      console.error('/api/admin/registrations/top-up database error:', fetchErr);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }
    if (existing.user_id === user.id) {
      return NextResponse.json({ error: 'You cannot review your own registration. Ask another staff member.' }, { status: 403 });
    }
    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Registration ${existing.registration_id} is already ${existing.status} and cannot be altered.` },
        { status: 400 }
      );
    }

    let changes: Record<string, unknown>;
    if (action === 'ask') {
      if (!isFee(amountDue)) {
        return NextResponse.json({ error: `The amount due must be a whole number of rupees from 1 to ${MAX_FEE}.` }, { status: 400 });
      }
      changes = { amount_due: amountDue };
    } else if (action === 'record') {
      if (existing.amount_due <= 0) {
        return NextResponse.json({ error: `No amount is due on ${existing.registration_id}.` }, { status: 409 });
      }
      if (typeof utr !== 'string' || !/^\d{12}$/.test(utr)) {
        return NextResponse.json({ error: 'UTR numbers are 12 digits.' }, { status: 400 });
      }
      changes = {
        amount_due: 0,
        top_up_utr: utr,
        top_up_recorded_by: user.id,
        top_up_recorded_at: new Date().toISOString(),
      };
    } else {
      return NextResponse.json({ error: "Invalid action. Must be 'ask' or 'record'" }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('registrations')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      // Only while still pending, so a review at the same moment wins cleanly.
      .eq('status', 'pending')
      .select()
      .maybeSingle();
    if (updateErr) {
      // uq_registrations_top_up_utr or trg_guard_top_up_utr.
      if (updateErr.code === '23505') return NextResponse.json({ error: UTR_TAKEN }, { status: 409 });
      console.error('/api/admin/registrations/top-up update failed:', updateErr);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: `Registration ${existing.registration_id} was just reviewed.` }, { status: 409 });
    }
    return NextResponse.json({ success: true, registration: updated });
  } catch (err: unknown) {
    console.error('/api/admin/registrations/top-up error:', err);
    return NextResponse.json({ error: 'Failed to update the registration.' }, { status: 500 });
  }
}
