import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationViewer } from '@/lib/auth-server';
import { sanitizeFilterValue } from '@/lib/security';

export const runtime = 'nodejs';

const REFERRALS_PAGE_SIZE = 30;

/**
 * GET /api/admin/referrals?page=1&q=
 * Referral leaderboard for admins, the registration team and viewers: one row per registrant whose code was used by at least
 * one confirmed or pending registration (public.referral_leaderboard, supabase/schema.sql section 14), most confirmed
 * referrals first. Paged on the server, REFERRALS_PAGE_SIZE rows per page; `q` searches name, email, college and code.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyRegistrationViewer(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get('page') || '1');
    if (!Number.isInteger(page) || page < 1 || page > 100_000) {
      return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
    }
    // Stripped of PostgREST filter syntax so a search term can't inject extra `.or()` conditions.
    const query = sanitizeFilterValue(searchParams.get('q'));

    const from = (page - 1) * REFERRALS_PAGE_SIZE;
    let dbQuery = auth.supabase
      .from('referral_leaderboard')
      .select(
        'rank, id, registration_id, name, email, college, referral_code, status, confirmed_referrals, pending_referrals',
        { count: 'exact' }
      )
      // A total order (id last), so rows never repeat or go missing between pages.
      .order('confirmed_referrals', { ascending: false })
      .order('pending_referrals', { ascending: false })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + REFERRALS_PAGE_SIZE - 1);

    if (query) {
      dbQuery = dbQuery.or(
        `name.ilike.%${query}%,email.ilike.%${query}%,college.ilike.%${query}%,referral_code.ilike.%${query}%,registration_id.ilike.%${query}%`
      );
    }

    const { data, error, count } = await dbQuery;
    // PostgREST answers 416 (PGRST103) for a page past the end, e.g. after the board shrank: report it as empty
    // (the dashboard then goes back to page 1).
    if (error && error.code !== 'PGRST103') {
      console.error('/api/admin/referrals database error:', error);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      referrers: error ? [] : data ?? [],
      total: count ?? 0,
      page,
      pageSize: REFERRALS_PAGE_SIZE,
    });
  } catch (err: unknown) {
    console.error('/api/admin/referrals error:', err);
    return NextResponse.json({ error: 'Failed to fetch the referral leaderboard' }, { status: 500 });
  }
}
