import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationStaff } from '@/lib/auth-server';
import { isFilterSafeEmail, readJsonObject } from '@/lib/security';
import { isFee, MAX_FEE } from '@/lib/seats';

export const runtime = 'nodejs';

const MAX_NOTE_LENGTH = 300;
const ALLOWED_FOR_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * POST /api/admin/registrations/payment-pass  { email, amount, note }
 * Registration-Team/Admin only. The staff route for a student who paid when they shouldn't have been able to (a saved
 * QR or the UPI ID while registrations were closed), after staff have checked the bank statement. It doesn't create a
 * registration: the student still fills in the form and submits their proof, at `amount`, and it is reviewed as usual.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyRegistrationStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = await readJsonObject(req);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    const { email, amount, note } = parsed.value;

    const normalized = typeof email === 'string' ? email.toLowerCase().trim() : '';
    if (!normalized || !isFilterSafeEmail(normalized)) {
      return NextResponse.json({ error: 'Enter the email address the student signs in with.' }, { status: 400 });
    }
    if (!isFee(amount)) {
      return NextResponse.json({ error: `The amount must be a whole number of rupees from 1 to ${MAX_FEE}.` }, { status: 400 });
    }
    const reason = typeof note === 'string' ? note.trim() : '';
    if (!reason || reason.length > MAX_NOTE_LENGTH) {
      return NextResponse.json({ error: `Add a note with the UTR you checked (up to ${MAX_NOTE_LENGTH} characters).` }, { status: 400 });
    }

    const { supabase, user } = auth;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalized)
      .maybeSingle();
    if (profileError) {
      console.error('/api/admin/registrations/payment-pass profile lookup failed:', profileError);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json(
        { error: 'No account with that email. Ask the student to sign in on the site once, then try again.' },
        { status: 404 }
      );
    }
    if (profile.id === user.id) {
      return NextResponse.json({ error: 'You cannot allow your own payment. Ask another staff member.' }, { status: 403 });
    }

    const [active, counter] = await Promise.all([
      supabase.from('registrations').select('registration_id').eq('user_id', profile.id).neq('status', 'rejected').limit(1).maybeSingle(),
      supabase.from('registration_counter').select('phase').eq('id', 1).maybeSingle(),
    ]);
    if (active.error || counter.error || !counter.data) {
      console.error('/api/admin/registrations/payment-pass lookup failed:', active.error || counter.error);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }
    if (active.data) {
      return NextResponse.json({ error: `This student already has registration ${active.data.registration_id}.` }, { status: 409 });
    }

    // Only one pass counts at a time: the newest.
    const now = new Date();
    const { error: retireError } = await supabase
      .from('payment_passes')
      .update({ used_at: now.toISOString() })
      .eq('user_id', profile.id)
      .is('used_at', null);
    if (retireError) {
      console.error('/api/admin/registrations/payment-pass retire failed:', retireError);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }
    // pay_by is now: staff have seen the payment, so the form skips the payment details and goes to the proof.
    const { error: insertError } = await supabase.from('payment_passes').insert({
      user_id: profile.id,
      phase: counter.data.phase,
      amount,
      pay_by: now.toISOString(),
      submit_by: new Date(now.getTime() + ALLOWED_FOR_MS).toISOString(),
      issued_by: user.id,
      note: reason,
    });
    if (insertError) {
      console.error('/api/admin/registrations/payment-pass insert failed:', insertError);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('/api/admin/registrations/payment-pass error:', err);
    return NextResponse.json({ error: 'Failed to allow the payment.' }, { status: 500 });
  }
}
