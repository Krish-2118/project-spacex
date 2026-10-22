import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getSupabaseAsUser } from '@/lib/supabase';
import { createRateLimiter } from '@/lib/security';
import { entryRateLimited, entryRpcFailure } from '@/lib/entry-route';

const limiter = createRateLimiter({ limit: 40, windowMs: 60_000 });

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const limited = entryRateLimited(limiter, auth.user.id);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  if (!body || !['claim', 'acknowledge'].includes(body.action) ||
    typeof body.claim !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.claim)) {
    return NextResponse.json({ error: 'Invalid experience request.' }, { status: 400 });
  }
  const db = getSupabaseAsUser(auth.token);
  const { data, error } = await db.rpc(body.action === 'claim' ? 'claim_pass_experience' : 'acknowledge_pass_experience', { p_claim: body.claim });
  if (error) return entryRpcFailure(error, '/api/pass/experience');
  return NextResponse.json({ result: data }, { headers: { 'Cache-Control': 'private, no-store' } });
}
