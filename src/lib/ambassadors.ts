import type { SupabaseClient } from '@supabase/supabase-js';
import { REFERRAL_CODE_FORMAT_ERROR, referralCodeKind } from '@/lib/security';

/**
 * Campus ambassadors and the referral codes a registrant may enter (supabase/schema.sql, sections 14 and 16).
 * Server-only: every caller is a route handler using the service role, after verifying the session.
 */

/** Who is registering, from the verified session (never from the request body). */
export interface Registrant {
  userId: string;
  /** Verified, lower-cased email. */
  email: string;
}

export type ReferralResolution =
  | { ok: true; kind: 'ambassador' | 'registrant'; referredBy: string | null; ambassadorId: string | null }
  | { ok: false; status: 400 | 500; error: string };

export const AMBASSADOR_CODE_INACTIVE_ERROR =
  'This campus ambassador code is no longer active. Remove it or enter another code.';
export const AMBASSADOR_CODE_OWN_ERROR =
  "This is your own campus ambassador code, so it can't count for you. Leave the field empty or enter someone else's code.";
const UNKNOWN_AMBASSADOR_ERROR =
  'No campus ambassador has this code. Check it with the ambassador who shared it, or leave the field empty.';
const UNKNOWN_REGISTRANT_ERROR =
  'No registration has this referral code. Check it with the friend who shared it, or leave the field empty.';
const LOOKUP_FAILED_ERROR = 'Failed to check the referral code. Please try again.';

/**
 * Who a normalized referral code credits, under the rules the database also enforces:
 *   - a registrant's 6-character code must belong to a registration that wasn't rejected;
 *   - a campus ambassador's code must be active and must not be the registrant's own (same email, or the account
 *     that claimed it). Any other ambassador's code is fine, from anyone, any number of times.
 */
export async function resolveReferralCode(
  client: SupabaseClient,
  code: string,
  registrant: Registrant
): Promise<ReferralResolution> {
  const kind = referralCodeKind(code);
  if (!kind) return { ok: false, status: 400, error: REFERRAL_CODE_FORMAT_ERROR };

  if (kind === 'ambassador') {
    const { data, error } = await client
      .from('campus_ambassadors')
      .select('id, email, user_id, status')
      .eq('code', code)
      .maybeSingle();
    if (error) {
      console.error('Ambassador code lookup failed:', error);
      return { ok: false, status: 500, error: LOOKUP_FAILED_ERROR };
    }
    if (!data) return { ok: false, status: 400, error: UNKNOWN_AMBASSADOR_ERROR };
    if (data.email === registrant.email || data.user_id === registrant.userId) {
      return { ok: false, status: 400, error: AMBASSADOR_CODE_OWN_ERROR };
    }
    if (data.status !== 'active') return { ok: false, status: 400, error: AMBASSADOR_CODE_INACTIVE_ERROR };
    return { ok: true, kind, referredBy: null, ambassadorId: data.id };
  }

  const { data, error } = await client
    .from('registrations')
    .select('id, status')
    .eq('referral_code', code)
    .maybeSingle();
  if (error) {
    console.error('Referral code lookup failed:', error);
    return { ok: false, status: 500, error: LOOKUP_FAILED_ERROR };
  }
  if (!data || data.status === 'rejected') return { ok: false, status: 400, error: UNKNOWN_REGISTRANT_ERROR };
  return { ok: true, kind, referredBy: data.id, ambassadorId: null };
}

/**
 * The database refused an ambassador code while the registration was written (trg_guard_registration_ambassador),
 * e.g. the ambassador was revoked after /api/register checked the code: the message for the referral field, or null.
 */
export function ambassadorGuardError(err: { message?: string } | null | undefined): string | null {
  const message = err?.message ?? '';
  if (/own campus ambassador code/i.test(message)) return AMBASSADOR_CODE_OWN_ERROR;
  if (/campus ambassador code is no longer active/i.test(message)) return AMBASSADOR_CODE_INACTIVE_ERROR;
  return null;
}

export interface OwnAmbassador {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'revoked';
  user_id: string | null;
}

/** The caller's own ambassador record, by verified email or by the account that claimed it; null when they're none. */
export async function findOwnAmbassador(
  client: SupabaseClient,
  registrant: Registrant
): Promise<{ ambassador: OwnAmbassador | null; error: unknown }> {
  const columns = 'id, code, name, status, user_id';
  const byEmail = await client.from('campus_ambassadors').select(columns).eq('email', registrant.email).maybeSingle();
  if (byEmail.error || byEmail.data) return { ambassador: byEmail.data as OwnAmbassador | null, error: byEmail.error };
  const byUser = await client.from('campus_ambassadors').select(columns).eq('user_id', registrant.userId).maybeSingle();
  return { ambassador: byUser.data as OwnAmbassador | null, error: byUser.error };
}
