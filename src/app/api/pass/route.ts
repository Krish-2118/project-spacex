import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getSupabaseAsUser } from '@/lib/supabase';
import { createRateLimiter } from '@/lib/security';
import { decryptEntryToken, encryptEntryToken, entryPassKey, mintEntryToken } from '@/lib/entry-pass';
import type { ParticipantPass } from '@/lib/pass-experience';
import { attemptsLeft } from '@/lib/rejections';

export const runtime = 'nodejs';

const passLimiter = createRateLimiter({ limit: 20, windowMs: 60 * 1000 });

interface MyEntryPass {
  registration_status: 'none' | 'pending' | 'confirmed' | 'rejected';
  registration_id?: string;
  name?: string;
  pass?: string | null;
  pass_status: 'none' | 'active' | 'revoked';
  token_ciphertext?: string | null;
  checked_in?: boolean;
}

/**
 * POST /api/pass
 * The CALLER's own entry pass. The QR token is returned only to the owner, only while the registration is confirmed
 * and the pass active. The first call after approval (or after a reissue) mints the token. POST, not GET, because
 * that first call writes.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Your session has expired. Please log in again.' }, { status: 401 });
    }
    if (!passLimiter.hit(auth.user.id)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(passLimiter.retryAfterSeconds(auth.user.id)) } }
      );
    }

    const db = getSupabaseAsUser(auth.token);
    const { data, error } = await db.rpc('my_entry_pass');
    if (error || !data) {
      console.error('/api/pass database error:', error);
      return NextResponse.json({ error: 'Could not load your pass.' }, { status: 500 });
    }
    const mine = data as MyEntryPass;

    // '*' rather than naming rejection_reason, so the pass keeps loading on a database without section 17 yet.
    const details = await db.from('registrations').select('*')
      .eq('user_id', auth.user.id).eq('registration_id', mine.registration_id ?? '').maybeSingle();
    if (details.error) return NextResponse.json({ error: 'Could not load your registration.' }, { status: 500 });
    const pass: ParticipantPass = {
      registrationStatus: mine.registration_status,
      passStatus: mine.pass_status,
      registrationId: mine.registration_id ?? null,
      name: mine.name ?? null,
      college: details.data?.college ?? null,
      checkedIn: !!mine.checked_in,
      token: null as string | null,
    };
    if (mine.registration_status === 'rejected') {
      // The reason staff gave, and whether the student may register again (REGISTER AGAIN on the pass).
      const rejected = await db.from('registrations').select('id', { count: 'exact', head: true })
        .eq('user_id', auth.user.id).eq('status', 'rejected');
      if (rejected.error) return NextResponse.json({ error: 'Could not load your registration.' }, { status: 500 });
      pass.rejectionReason = details.data?.rejection_reason ?? null;
      pass.attemptsLeft = attemptsLeft(rejected.count ?? 0);
    }
    if (mine.registration_status !== 'confirmed' || mine.pass_status !== 'active' || !mine.pass) {
      return NextResponse.json({ success: true, pass }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    const key = entryPassKey();
    if (!key) {
      console.error('/api/pass: ENTRY_PASS_ENCRYPTION_KEY is missing or not 32 bytes');
      pass.qrUnavailable = 'Your payment is verified. The check-in QR is temporarily unavailable; please check again later.';
      return NextResponse.json({ success: true, pass }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    let ciphertext = mine.token_ciphertext ?? null;
    if (!ciphertext) {
      const { token, hash } = mintEntryToken();
      const claimed = await db.rpc('claim_entry_pass_token', {
        p_pass: mine.pass,
        p_hash: hash,
        p_ciphertext: encryptEntryToken(token, mine.pass, key),
      });
      if (claimed.error || typeof claimed.data !== 'string') {
        console.error('/api/pass claim error:', claimed.error);
        return NextResponse.json({ error: 'Could not create your pass. Please try again.' }, { status: 500 });
      }
      ciphertext = claimed.data; // ours, or the one a parallel request stored first
    }

    pass.token = decryptEntryToken(ciphertext, mine.pass, key);
    if (!pass.token) {
      console.error('/api/pass: stored token does not decrypt (wrong ENTRY_PASS_ENCRYPTION_KEY?)');
      return NextResponse.json({ error: 'Your pass could not be loaded. Please contact the help desk.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, pass }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err: unknown) {
    console.error('/api/pass error:', err);
    return NextResponse.json({ error: 'Could not load your pass.' }, { status: 500 });
  }
}
