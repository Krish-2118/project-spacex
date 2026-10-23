import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { createRateLimiter, readJsonObject } from '@/lib/security';

export const runtime = 'nodejs';

const codeLimiter = createRateLimiter({ limit: 30, windowMs: 10 * 60 * 1000 });

const COLUMNS = 'id, code, name, status, user_id';

type AmbassadorRow = { id: string; code: string; name: string; status: string; user_id: string | null };

const cleanText = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/** The name staff see on the AMBASSADORS tab: the profile's, else Google's, else the email's local part. */
async function displayName(client: SupabaseClient, user: User, email: string): Promise<string> {
  const { data: profile } = await client.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const md = user.user_metadata || {};
  return (cleanText(profile?.full_name) || cleanText(md.full_name) || cleanText(md.name) || email.split('@')[0]).slice(0, 120);
}

/**
 * POST /api/ambassador/code  {}  or  { create: true, college }
 * GET MY CODE in the home page's Campus Ambassador section. Any signed-in student with a verified email can be a
 * campus ambassador; nobody approves them (the section's APPLY button only opens the organisers' Google Form).
 * The request proxy gates /api/ambassador/* to signed-in callers too. Matched on the session's verified email
 * (Supabase Auth, never the profile or the body), against supabase/schema.sql section 16:
 *   {}                         -> { ambassador: { code, name, status: 'active' } }  their permanent code, or
 *                                 { ambassador: null, email, name, college }        none yet: the dialog asks for their
 *                                                                                   college (pre-filled from their
 *                                                                                   registration, if any)
 *   { create: true, college }  -> creates it (the database makes the code) and answers like the first case
 *   either                     -> { ambassador: { status: 'revoked' } }              revoked by staff: no code
 * The row is linked to the caller's account (user_id), which /api/register uses to refuse an ambassador's own code
 * and the AMBASSADORS tab uses for their phone. Only this route creates rows; no client role can touch the table.
 * A POST, not a GET, because it writes: the request proxy refuses cross-site POSTs.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Please log in to get your ambassador code.' }, { status: 401 });
    }
    const { user, token } = auth;
    const email = (user.email || '').trim().toLowerCase();
    if (!email || !user.email_confirmed_at) {
      return NextResponse.json(
        { error: 'Your sign-in email is not verified. Please log in with Google again.' },
        { status: 403 }
      );
    }

    if (!codeLimiter.hit(user.id)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(codeLimiter.retryAfterSeconds(user.id)) } }
      );
    }

    const body = await readJsonObject(req);
    if (!body.ok && body.status === 413) return NextResponse.json({ error: body.error }, { status: 413 });
    const input: Record<string, unknown> = body.ok ? body.value : {};

    const client = getSupabaseAdmin(token);
    const byEmail = () => client.from('campus_ambassadors').select(COLUMNS).eq('email', email).maybeSingle();
    const found = await byEmail();
    if (found.error) {
      console.error('/api/ambassador/code lookup failed:', found.error);
      return NextResponse.json({ error: 'Failed to check your ambassador code. Please try again.' }, { status: 500 });
    }
    let amb = found.data as AmbassadorRow | null;

    if (!amb && input.create !== true) {
      const { data: reg } = await client
        .from('registrations')
        .select('college')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return NextResponse.json({
        success: true,
        ambassador: null,
        email,
        name: await displayName(client, user, email),
        college: reg?.college ?? '',
      });
    }

    if (!amb) {
      const college = cleanText(input.college);
      if (college.length < 3 || college.length > 200) {
        return NextResponse.json(
          { error: 'Enter your college name (3 to 200 characters).', field: 'college' },
          { status: 400 }
        );
      }
      const row = { email, name: await displayName(client, user, email), college, user_id: user.id };
      let ins = await client.from('campus_ambassadors').insert(row).select(COLUMNS).single();
      // A generated code that collided with one made at the same moment: the trigger draws a new one on retry.
      if (ins.error?.code === '23505' && /code/i.test(`${ins.error.message} ${ins.error.details ?? ''}`)) {
        ins = await client.from('campus_ambassadors').insert(row).select(COLUMNS).single();
      }
      if (ins.error?.code === '23505') {
        // Created by a double tap a moment ago: answer with that one.
        const again = await byEmail();
        if (again.data) amb = again.data as AmbassadorRow;
        else {
          // This account already has a code under the email it used to have.
          console.warn('/api/ambassador/code: account already linked to another ambassador row', ins.error);
          return NextResponse.json(
            { error: 'Your account already has an ambassador code under another email. Please contact the registration team.' },
            { status: 409 }
          );
        }
      } else if (ins.error || !ins.data) {
        console.error('/api/ambassador/code create failed:', ins.error);
        return NextResponse.json({ error: 'Failed to create your ambassador code. Please try again.' }, { status: 500 });
      } else {
        amb = ins.data as AmbassadorRow;
      }
    } else if (amb.user_id !== user.id) {
      // The verified email is theirs, so is the code: link this account (e.g. their sign-in was deleted and created
      // again). Not fatal if it fails; the code is still shown.
      const { error: linkErr } = await client.from('campus_ambassadors').update({ user_id: user.id }).eq('id', amb.id);
      if (linkErr) console.warn('/api/ambassador/code link failed:', linkErr);
    }

    if (amb.status !== 'active') {
      return NextResponse.json({ success: true, ambassador: { status: 'revoked' }, email });
    }
    return NextResponse.json({ success: true, ambassador: { code: amb.code, name: amb.name, status: 'active' }, email });
  } catch (err: unknown) {
    console.error('API /api/ambassador/code error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
