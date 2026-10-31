import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationStaff, verifyRegistrationViewer } from '@/lib/auth-server';
import { isIdCardPath, isUuid, readJsonObject } from '@/lib/security';
import { ID_CARD_URL_TTL_SECONDS, signIdCardUrl } from '@/lib/id-card-storage';
import { isIdCardReuploadReason } from '@/lib/id-cards';

export const runtime = 'nodejs';

/**
 * GET /api/admin/registrations/id-card?id=<registration uuid>
 * Registration-Team/Admin/Viewer only. Returns a short-lived signed URL for the registration's private college ID card
 * photo.
 * Staff have no Storage read access of their own: this route is the only way to view a card (the admin list and the
 * gate scanner both use it).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyRegistrationViewer(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = new URL(req.url).searchParams.get('id');
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Invalid registration id' }, { status: 400 });
    }

    const { data: registration, error } = await auth.supabase
      .from('registrations')
      .select('user_id, id_card_path')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('/api/admin/registrations/id-card database error:', error);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }
    if (!registration?.id_card_path) {
      return NextResponse.json({ error: 'No ID card uploaded for this registration' }, { status: 404 });
    }

    // Only ever sign an object inside the registrant's own folder, never an arbitrary path stored in the row.
    if (!isIdCardPath(registration.id_card_path, registration.user_id)) {
      return NextResponse.json({ error: 'Stored ID card is not a recognised upload' }, { status: 422 });
    }
    const url = await signIdCardUrl(registration.id_card_path);
    if (!url) {
      return NextResponse.json({ error: 'Failed to load the ID card' }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, url, expiresAt: new Date(Date.now() + ID_CARD_URL_TTL_SECONDS * 1000).toISOString() },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err: unknown) {
    console.error('/api/admin/registrations/id-card error:', err);
    return NextResponse.json({ error: 'Failed to load the ID card' }, { status: 500 });
  }
}

/**
 * POST /api/admin/registrations/id-card  { registrationId, reason }
 * Registration-Team/Admin only. Asks the student for a new ID card photo: clears id_card_path and stores the reason,
 * so MY PASS shows "ID card pending" with it and a pending registration can't be approved until they upload again.
 * The old photo stays in storage. Not for a rejected registration, one already checked in at the gate, or the
 * caller's own.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyRegistrationStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = await readJsonObject(req);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { registrationId, reason } = parsed.value;
    if (!isUuid(registrationId)) {
      return NextResponse.json({ error: 'Invalid registrationId' }, { status: 400 });
    }
    if (!isIdCardReuploadReason(reason)) {
      return NextResponse.json({ error: 'Choose why a new ID card is needed.' }, { status: 400 });
    }

    const { supabase, user } = auth;
    const { data: existing, error: fetchErr } = await supabase
      .from('registrations')
      .select('id, user_id, registration_id, status, id_card_path')
      .eq('id', registrationId)
      .maybeSingle();
    if (fetchErr) {
      console.error('/api/admin/registrations/id-card database error:', fetchErr);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }
    if (existing.user_id === user.id) {
      return NextResponse.json(
        { error: 'You cannot review your own registration. Ask another staff member.' },
        { status: 403 }
      );
    }
    if (existing.status === 'rejected') {
      return NextResponse.json(
        { error: `Registration ${existing.registration_id} is rejected: there is no ID card to ask for.` },
        { status: 400 }
      );
    }
    if (!existing.id_card_path) {
      return NextResponse.json(
        { error: `Registration ${existing.registration_id} has no ID card uploaded yet.` },
        { status: 409 }
      );
    }

    const { data: checkin, error: checkinErr } = await supabase
      .from('entry_checkins')
      .select('id')
      .eq('registration_id', existing.id)
      .is('voided_at', null)
      .limit(1)
      .maybeSingle();
    if (checkinErr) {
      console.error('/api/admin/registrations/id-card check-in lookup error:', checkinErr);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }
    if (checkin) {
      return NextResponse.json(
        { error: `Registration ${existing.registration_id} is already checked in at the gate.` },
        { status: 409 }
      );
    }

    // Only clears the card staff looked at: a new one uploaded meanwhile is kept.
    const { data: updated, error: updateErr } = await supabase
      .from('registrations')
      .update({ id_card_path: null, id_card_uploaded_at: null, id_card_reupload_reason: reason })
      .eq('id', existing.id)
      .eq('id_card_path', existing.id_card_path)
      .neq('status', 'rejected')
      .select()
      .maybeSingle();
    if (updateErr) {
      console.error('/api/admin/registrations/id-card database error:', updateErr);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json(
        { error: `Registration ${existing.registration_id} changed meanwhile. Reload and try again.` },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, registration: updated });
  } catch (err: unknown) {
    console.error('/api/admin/registrations/id-card error:', err);
    return NextResponse.json({ error: 'Failed to ask for a new ID card' }, { status: 500 });
  }
}
