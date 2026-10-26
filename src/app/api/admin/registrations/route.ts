import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyRegistrationStaff } from '@/lib/auth-server';
import { isUuid, readJsonObject, sanitizeFilterValue } from '@/lib/security';
import { isRejectionReason } from '@/lib/rejections';

export const runtime = 'nodejs';

// PostgREST silently caps every response at the project's "Max rows" (1,000 by default), so the list is read in
// batches. A batch shorter than requested does not mean the end (the cap may be lower than BATCH_SIZE): only an
// empty batch does. MAX_BATCHES bounds the work per request.
const BATCH_SIZE = 1000;
const MAX_BATCHES = 20;
// Ids per `in.(...)` lookup, keeping the request URL short.
const LOOKUP_CHUNK = 150;

/** Who brought a registration in: the registrant's code they entered, or a campus ambassador's (never both). */
type ReferredVia = { kind: 'registrant' | 'ambassador'; code: string; name: string } | null;

/** Reads `columns` of the rows of `table` with these ids, in chunks. */
async function rowsById(supabase: SupabaseClient, table: string, columns: string, ids: string[]) {
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < ids.length; i += LOOKUP_CHUNK) {
    const { data, error } = await supabase.from(table).select(columns).in('id', ids.slice(i, i + LOOKUP_CHUNK));
    if (error) return { rows, error };
    rows.push(...((data ?? []) as unknown as Record<string, string>[]));
  }
  return { rows, error: null };
}

/**
 * attempt for every row (1 = the user's first registration, 2 = made again after one rejection, ...) and
 * previous_rejection_reason, why the user's registration before it was rejected. Every earlier registration of a user
 * is a rejected one (only one may be pending or confirmed), so the user's rejected rows are enough, whatever the
 * filters list.
 */
async function withAttempts(supabase: SupabaseClient, registrations: Record<string, unknown>[]) {
  const userIds = [...new Set(registrations.map((r) => r.user_id).filter((v): v is string => typeof v === 'string'))];
  const rejected: Record<string, string>[] = [];
  for (let i = 0; i < userIds.length; i += LOOKUP_CHUNK) {
    // '*' rather than naming rejection_reason, so the list keeps loading on a database without section 17 yet.
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('status', 'rejected')
      .in('user_id', userIds.slice(i, i + LOOKUP_CHUNK));
    if (error) return { error, registrations };
    rejected.push(...((data ?? []) as Record<string, string>[]));
  }
  const byUser = new Map<string, Record<string, string>[]>();
  for (const r of rejected) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  return {
    error: null,
    registrations: registrations.map((r) => {
      const earlier = (byUser.get(r.user_id as string) ?? [])
        .filter((x) => x.id !== r.id && x.created_at < (r.created_at as string))
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      return {
        ...r,
        attempt: earlier.length + 1,
        previous_rejection_reason: earlier.at(-1)?.rejection_reason ?? null,
      };
    }),
  };
}

/** referred_via for every row: the referrer's code and name, looked up whether or not the filters list the referrer. */
async function withReferredVia(supabase: SupabaseClient, registrations: Record<string, unknown>[]) {
  const ids = (key: string) => [...new Set(registrations.map((r) => r[key]).filter((v): v is string => typeof v === 'string'))];
  const [friends, ambassadors] = await Promise.all([
    rowsById(supabase, 'registrations', 'id, referral_code, name', ids('referred_by')),
    rowsById(supabase, 'campus_ambassadors', 'id, code, name', ids('ambassador_id')),
  ]);
  if (friends.error || ambassadors.error) return { error: friends.error || ambassadors.error, registrations };
  const friendById = new Map(friends.rows.map((f) => [f.id, f]));
  const ambassadorById = new Map(ambassadors.rows.map((a) => [a.id, a]));
  return {
    error: null,
    registrations: registrations.map((r) => {
      const friend = friendById.get(r.referred_by as string);
      const amb = ambassadorById.get(r.ambassador_id as string);
      const referred_via: ReferredVia = amb
        ? { kind: 'ambassador', code: amb.code, name: amb.name }
        : friend
        ? { kind: 'registrant', code: friend.referral_code, name: friend.name }
        : null;
      return { ...r, referred_via };
    }),
  };
}

/**
 * reviewed_by_name for every row: the name (or email) of the staff member who approved or rejected it, null while
 * pending. Admins only: the Registration-Team list does not say who reviewed what.
 */
async function withReviewer(supabase: SupabaseClient, registrations: Record<string, unknown>[]) {
  const ids = [...new Set(registrations.map((r) => r.reviewed_by).filter((v): v is string => typeof v === 'string'))];
  const reviewers = await rowsById(supabase, 'profiles', 'id, full_name, email', ids);
  if (reviewers.error) return { error: reviewers.error, registrations };
  const reviewerById = new Map(reviewers.rows.map((p) => [p.id, p]));
  return {
    error: null,
    registrations: registrations.map((r) => {
      const reviewer = reviewerById.get(r.reviewed_by as string);
      return { ...r, reviewed_by_name: reviewer ? reviewer.full_name?.trim() || reviewer.email || null : null };
    }),
  };
}

// GET all registrations (with optional filtering)
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyRegistrationStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabase, role } = auth;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const studentType = searchParams.get('student_type');
    // Only the registrations made with this campus ambassador's code (the AMBASSADORS tab's per-ambassador list).
    const ambassador = searchParams.get('ambassador');
    // Stripped of PostgREST filter syntax so a search term can't inject extra `.or()` conditions.
    const query = sanitizeFilterValue(searchParams.get('q'));

    if (status && status !== 'all' && !['pending', 'confirmed', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
    }
    if (studentType && studentType !== 'all' && !['internal', 'external'].includes(studentType)) {
      return NextResponse.json({ error: 'Invalid student_type filter' }, { status: 400 });
    }
    if (ambassador && !isUuid(ambassador)) {
      return NextResponse.json({ error: 'Invalid ambassador filter' }, { status: 400 });
    }

    // Oldest first with a unique tie-breaker: a total order, and registrations created while we page land after
    // the rows already read instead of shifting them (no duplicates, no skips). Reversed to newest first below.
    const buildQuery = () => {
      let dbQuery = supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (status && status !== 'all') dbQuery = dbQuery.eq('status', status);
      if (studentType && studentType !== 'all') dbQuery = dbQuery.eq('student_type', studentType);
      if (ambassador) dbQuery = dbQuery.eq('ambassador_id', ambassador);
      if (query) {
        dbQuery = dbQuery.or(
          `name.ilike.%${query}%,email.ilike.%${query}%,registration_id.ilike.%${query}%,college.ilike.%${query}%,utr.ilike.%${query}%,enrollment_no.ilike.%${query}%`
        );
      }
      return dbQuery;
    };

    const registrations: { id: string }[] = [];
    const seen = new Set<string>();
    let from = 0;
    for (let batch = 0; ; batch++) {
      const { data, error } = await buildQuery().range(from, from + BATCH_SIZE - 1);

      if (error) {
        console.error('/api/admin/registrations database error:', error);
        return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      if (batch === MAX_BATCHES) {
        // Never answer with a silently truncated list.
        console.error(`/api/admin/registrations: more than ${registrations.length} rows, stopped after ${MAX_BATCHES} batches`);
        return NextResponse.json(
          { error: 'Too many registrations to list at once. Narrow the filters and try again.' },
          { status: 500 }
        );
      }

      for (const row of data) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          registrations.push(row);
        }
      }
      from += data.length;
    }

    const enriched = await withReferredVia(supabase, registrations.reverse());
    if (enriched.error) {
      console.error('/api/admin/registrations referrer lookup error:', enriched.error);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }
    const counted = await withAttempts(supabase, enriched.registrations);
    if (counted.error) {
      console.error('/api/admin/registrations attempts lookup error:', counted.error);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }
    if (role !== 'admin') {
      // Who reviewed a registration is for admins only.
      const anonymous = counted.registrations.map((r) => ({ ...r, reviewed_by: null }));
      return NextResponse.json({ success: true, registrations: anonymous });
    }
    const reviewed = await withReviewer(supabase, counted.registrations);
    if (reviewed.error) {
      console.error('/api/admin/registrations reviewer lookup error:', reviewed.error);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, registrations: reviewed.registrations });
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
    const { registrationId, status, reason } = parsed.value;

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

    // Every rejection says why: the student sees it on their pass before registering again.
    if (status === 'rejected' && !isRejectionReason(reason)) {
      return NextResponse.json({ error: 'Choose why this registration is rejected.' }, { status: 400 });
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
        ...(status === 'rejected' ? { rejection_reason: reason } : {}),
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
