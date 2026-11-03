import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-server';
import { getSupabaseAsUser } from '@/lib/supabase';
import { createRateLimiter, sanitizeFilterValue } from '@/lib/security';
import { parsePage } from '@/lib/entry-pass';
import { badRequest, entryAuthFailure, entryRateLimited, entryRpcFailure } from '@/lib/entry-route';

export const runtime = 'nodejs';

// The dashboard polls every 30 s; this leaves room for searching and paging on top.
const overviewLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 1000 });

const PAGE_SIZE = 30;
const LISTS = ['registrations', 'checkins', 'rejections', 'audit'] as const;
type List = (typeof LISTS)[number];
const FILTERS = ['all', 'checked_in', 'waiting'] as const;
const AUDIT_ACTIONS = ['lookup', 'manual_lookup', 'check_in', 'reject', 'void', 'reissue'] as const;

/**
 * GET /api/admin/entry/overview?list=registrations|checkins|rejections|audit&q=&page=&filter=&action=
 * Admin only, read-only (no GET writes anything). Counts per registration plus one page of the chosen list.
 * Reads run as the admin (getSupabaseAsUser), so the admin-only RLS on the entry tables applies.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req);
    if ('error' in auth) {
      return entryAuthFailure(auth);
    }
    const limited = entryRateLimited(overviewLimiter, auth.user.id);
    if (limited) return limited;
    const db = getSupabaseAsUser(auth.token);

    const params = req.nextUrl.searchParams;
    const list = (params.get('list') || 'registrations') as List;
    if (!LISTS.includes(list)) return badRequest('Invalid list.');
    const filter = params.get('filter') || 'all';
    if (!(FILTERS as readonly string[]).includes(filter)) return badRequest('Invalid filter.');
    const action = params.get('action') || '';
    if (action && !(AUDIT_ACTIONS as readonly string[]).includes(action)) return badRequest('Invalid action.');
    // Stripped of PostgREST filter syntax so a search term can't inject extra `.or()` conditions.
    const q = sanitizeFilterValue(params.get('q'), 60);
    const page = parsePage(params.get('page'));
    const from = (page - 1) * PAGE_SIZE;

    const counts = await db.rpc('entry_overview_counts');
    if (counts.error) return entryRpcFailure(counts.error, '/api/admin/entry/overview');

    let query;
    if (list === 'registrations') {
      query = db.from('entry_overview').select('*');
      if (filter === 'checked_in') query = query.not('checkin_id', 'is', null);
      if (filter === 'waiting') query = query.is('checkin_id', null);
      if (q) query = query.or(`registration_id.ilike.%${q}%,enrollment_no.ilike.%${q}%,name.ilike.%${q}%`);
      query = query.order('registration_id', { ascending: true });
    } else if (list === 'checkins') {
      query = db.from('entry_checkin_feed').select('*');
      if (q) query = query.or(`registration_id.ilike.%${q}%,enrollment_no.ilike.%${q}%,name.ilike.%${q}%`);
      query = query.order('created_at', { ascending: false });
    } else {
      query = db.from('entry_audit_feed').select('*');
      if (list === 'rejections') query = query.eq('action', 'reject');
      else if (action) query = query.eq('action', action);
      if (q) query = query.or(`registration_id.ilike.%${q}%,name.ilike.%${q}%,actor_name.ilike.%${q}%`);
      query = query.order('created_at', { ascending: false });
    }

    // One row more than a page tells whether a next page exists, without counting the whole table.
    const { data, error } = await query.range(from, from + PAGE_SIZE);
    if (error) return entryRpcFailure(error, '/api/admin/entry/overview');
    const rows = data ?? [];

    return NextResponse.json({
      success: true,
      counts: counts.data,
      list,
      page,
      pageSize: PAGE_SIZE,
      hasMore: rows.length > PAGE_SIZE,
      rows: rows.slice(0, PAGE_SIZE),
    });
  } catch (err: unknown) {
    console.error('/api/admin/entry/overview error:', err);
    return NextResponse.json({ error: 'Failed to load entry data.' }, { status: 500 });
  }
}
