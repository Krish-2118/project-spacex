import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationStaff, verifyRegistrationViewer } from '@/lib/auth-server';
import { isUuid, readJsonObject } from '@/lib/security';

export const runtime = 'nodejs';

/**
 * Campus ambassadors, for admins and the registration team only (verifyRegistrationStaff; the read-only 'viewer' role
 * may GET, verifyRegistrationViewer): the AMBASSADORS tab of the admin dashboard is the programme's only portal. Students become ambassadors themselves (GET MY CODE, POST
 * /api/ambassador/code); staff watch the counts, contact them and revoke a code that is abused. Everything runs as the
 * service role: no client role can read or write the table or the leaderboard view (supabase/schema.sql, section 16).
 *
 *   GET                                         every ambassador with their counts (ambassador_leaderboard), plus
 *                                               their email (this table) and phone (their profile)
 *   PATCH  { id, action: 'revoke' | 'restore' } or { id, name?, college? }
 *   DELETE ?id=                                 only while no registration has used the code (otherwise revoke)
 */

/** PostgREST answers at most its "Max rows" (1000 by default) per request. */
const MAX_LIST_ROWS = 1000;
// Ids per `in.(...)` lookup, keeping the request URL short.
const LOOKUP_CHUNK = 150;

const LEADERBOARD_COLUMNS = 'rank, id, code, name, college, status, created_at, confirmed_registrations, pending_registrations';

const cleanText = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

const dbError = (where: string, error: unknown) => {
  console.error(`/api/admin/ambassadors ${where} database error:`, error);
  return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
};

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyRegistrationViewer(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase } = auth;

    const [board, contacts] = await Promise.all([
      supabase.from('ambassador_leaderboard').select(LEADERBOARD_COLUMNS).order('created_at').order('id').range(0, MAX_LIST_ROWS - 1),
      supabase.from('campus_ambassadors').select('id, email, user_id').order('created_at').order('id').range(0, MAX_LIST_ROWS - 1),
    ]);
    if (board.error) return dbError('GET', board.error);
    if (contacts.error) return dbError('GET', contacts.error);

    // Phones come from the ambassadors' profiles (every signed-in user is asked for one).
    const userIds = [...new Set((contacts.data ?? []).map((c) => c.user_id).filter((id): id is string => !!id))];
    const phoneByUser = new Map<string, string | null>();
    for (let i = 0; i < userIds.length; i += LOOKUP_CHUNK) {
      const { data, error } = await supabase.from('profiles').select('id, phone').in('id', userIds.slice(i, i + LOOKUP_CHUNK));
      if (error) return dbError('GET', error);
      for (const p of data ?? []) phoneByUser.set(p.id, p.phone);
    }

    const byId = new Map((contacts.data ?? []).map((c) => [c.id, c]));
    const ambassadors = (board.data ?? [])
      .map((a) => {
        const contact = byId.get(a.id);
        return { ...a, email: contact?.email ?? '', phone: (contact?.user_id && phoneByUser.get(contact.user_id)) || null };
      })
      // Active ambassadors by rank (most confirmed first), then the revoked ones; oldest first within a tie.
      .sort((x, y) =>
        (x.rank ?? Number.MAX_SAFE_INTEGER) - (y.rank ?? Number.MAX_SAFE_INTEGER) ||
        y.pending_registrations - x.pending_registrations ||
        String(x.created_at).localeCompare(String(y.created_at))
      );
    const truncated = ambassadors.length >= MAX_LIST_ROWS;
    if (truncated) console.error(`/api/admin/ambassadors: ${MAX_LIST_ROWS}+ ambassadors, the list is cut short`);

    return NextResponse.json({ success: true, ambassadors, truncated });
  } catch (err: unknown) {
    console.error('/api/admin/ambassadors GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch campus ambassadors' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyRegistrationStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await readJsonObject(req);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
    const { id, action } = body.value;
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid ambassador id' }, { status: 400 });

    const update: Record<string, string | null> = {};
    if (action !== undefined) {
      if (action === 'revoke') update.status = 'revoked';
      else if (action === 'restore') update.status = 'active';
      else return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } else {
      if ('name' in body.value) {
        const name = cleanText(body.value.name);
        if (!name || name.length > 120) return NextResponse.json({ error: 'Names must be 1 to 120 characters.' }, { status: 400 });
        update.name = name;
      }
      if ('college' in body.value) {
        const college = body.value.college === null ? '' : cleanText(body.value.college);
        if (college.length > 200) {
          return NextResponse.json({ error: 'College names must be at most 200 characters.' }, { status: 400 });
        }
        update.college = college || null;
      }
      if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from('campus_ambassadors')
      .update(update)
      .eq('id', id)
      .select('id, name, college, code, status')
      .maybeSingle();
    if (error) return dbError('PATCH', error);
    if (!data) return NextResponse.json({ error: 'Ambassador not found' }, { status: 404 });
    return NextResponse.json({ success: true, ambassador: data });
  } catch (err: unknown) {
    console.error('/api/admin/ambassadors PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update the campus ambassador' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyRegistrationStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = new URL(req.url).searchParams.get('id');
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid ambassador id' }, { status: 400 });

    const { data, error } = await auth.supabase.from('campus_ambassadors').delete().eq('id', id).select('id');
    if (error) {
      // registrations.ambassador_id ON DELETE RESTRICT (restrict_violation; 23503 if it ever becomes NO ACTION):
      // someone registered with this code.
      if (error.code === '23001' || error.code === '23503') {
        return NextResponse.json(
          { error: 'Someone has already registered with this code, so it can only be revoked, not deleted.' },
          { status: 409 }
        );
      }
      return dbError('DELETE', error);
    }
    if (!data?.length) return NextResponse.json({ error: 'Ambassador not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('/api/admin/ambassadors DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete the campus ambassador' }, { status: 500 });
  }
}
