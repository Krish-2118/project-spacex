import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationStaff } from '@/lib/auth-server';
import { isUuid, readJsonObject, sanitizeFilterValue } from '@/lib/security';

export const runtime = 'nodejs';

// GET all registrations (with optional filtering)
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyRegistrationStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabase } = auth;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const studentType = searchParams.get('student_type');
    // Stripped of PostgREST filter syntax so a search term can't inject extra `.or()` conditions.
    const query = sanitizeFilterValue(searchParams.get('q'));

    let dbQuery = supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      if (!['pending', 'confirmed', 'rejected'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
      }
      dbQuery = dbQuery.eq('status', status);
    }

    if (studentType && studentType !== 'all') {
      if (!['internal', 'external'].includes(studentType)) {
        return NextResponse.json({ error: 'Invalid student_type filter' }, { status: 400 });
      }
      dbQuery = dbQuery.eq('student_type', studentType);
    }

    if (query) {
      dbQuery = dbQuery.or(
        `name.ilike.%${query}%,email.ilike.%${query}%,registration_id.ilike.%${query}%,college.ilike.%${query}%,utr.ilike.%${query}%,enrollment_no.ilike.%${query}%`
      );
    }

    const { data: registrations, error } = await dbQuery;

    if (error) {
      console.error('/api/admin/registrations database error:', error);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, registrations: registrations || [] });
  } catch (err: unknown) {
    console.error('/api/admin/registrations error:', err);
    const message = 'Failed to fetch registrations';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// PATCH approve or reject registration ("once done cannot be altered")
export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyRegistrationStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = await readJsonObject(req);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { registrationId, status } = parsed.value;

    if (!registrationId || !status) {
      return NextResponse.json(
        { error: 'Missing registrationId or status' },
        { status: 400 }
      );
    }

    if (!isUuid(registrationId)) {
      return NextResponse.json({ error: 'Invalid registrationId' }, { status: 400 });
    }

    if (status !== 'confirmed' && status !== 'rejected') {
      return NextResponse.json(
        { error: "Invalid status. Must be 'confirmed' or 'rejected'" },
        { status: 400 }
      );
    }

    const { supabase, user } = auth;

    // Fetch existing registration to verify status
    const { data: existing, error: fetchErr } = await supabase
      .from('registrations')
      .select('id, status, registration_id, user_id')
      .eq('id', registrationId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // Segregation of duties: staff can't approve or reject their own registration.
    if (existing.user_id === user.id) {
      return NextResponse.json(
        { error: 'You cannot review your own registration. Ask another staff member.' },
        { status: 403 }
      );
    }

    // STRICT RULE: Once done cannot be altered!
    if (existing.status !== 'pending') {
      return NextResponse.json(
        {
          error: `Registration ${existing.registration_id} is already ${existing.status.toUpperCase()} and cannot be altered.`,
        },
        { status: 400 }
      );
    }

    const { data: updated, error: updateErr } = await supabase
      .from('registrations')
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      // Only transition rows that are still pending, so two concurrent reviews can't both win.
      .eq('status', 'pending')
      .select()
      .maybeSingle();

    if (updateErr) {
      console.error('/api/admin/registrations database error:', updateErr);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json(
        { error: `Registration ${existing.registration_id} was already reviewed and cannot be altered.` },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, registration: updated });
  } catch (err: unknown) {
    console.error('/api/admin/registrations error:', err);
    const message = 'Failed to update registration status';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
