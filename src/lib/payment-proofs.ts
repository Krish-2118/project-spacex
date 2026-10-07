import { createClient } from '@supabase/supabase-js';
import { isPaymentProofPath, PAYMENT_PROOFS_BUCKET, PAYMENT_PROOF_URL_TTL_SECONDS } from '@/lib/security';

/**
 * Server-only access to the private `payment-proofs` Storage bucket. Import from API routes only: never from a
 * client component (the service-role key must stay on the server).
 *
 * Users have NO Storage INSERT policy on this bucket: a JWT plus the public key can't upload directly, so every proof
 * goes through /api/upload (auth, rate limit, size and magic-byte checks) and is written here with the service role.
 * Existence checks still run AS THE SIGNED-IN USER, so Storage RLS only lets them see their own folder. Staff signed
 * URLs use the service role, after the route has checked the caller is IT-Team/Admin.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

const noSession = { persistSession: false, autoRefreshToken: false };

function bucketAsUser(accessToken: string) {
  return createClient(supabaseUrl, publishableKey, {
    auth: noSession,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  }).storage.from(PAYMENT_PROOFS_BUCKET);
}

function bucketAsServiceRole() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, { auth: noSession }).storage.from(PAYMENT_PROOFS_BUCKET);
}

/**
 * Uploads a validated screenshot to `path` with the service role. Never overwrites an existing object. The service
 * role bypasses Storage RLS, so the own-folder / server-shaped-name rule is re-checked here before writing.
 */
export async function uploadPaymentProof(
  ownerId: string,
  path: string,
  body: Buffer,
  contentType: string
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  if (!isPaymentProofPath(path, ownerId)) return { ok: false, error: new Error('payment proof path outside the owner folder') };
  const bucket = bucketAsServiceRole();
  if (!bucket) return { ok: false, error: new Error('SUPABASE_SERVICE_ROLE_KEY is not configured') };
  const { error } = await bucket.upload(path, body, { contentType, upsert: false });
  return error ? { ok: false, error } : { ok: true };
}

/** True if the object exists AND the user can see it (the SELECT policy only shows a user their own folder). */
export async function paymentProofExists(accessToken: string, path: string): Promise<boolean> {
  const { data, error } = await bucketAsUser(accessToken).exists(path);
  return !error && data === true;
}

/**
 * Short-lived signed URL for a payment screenshot. Callers must have authorized the request (verifyStaff) and
 * checked that `path` belongs to the registration's owner. Returns null when the service role isn't configured.
 */
export async function signPaymentProofUrl(path: string): Promise<string | null> {
  const bucket = bucketAsServiceRole();
  if (!bucket) return null;
  const { data, error } = await bucket.createSignedUrl(path, PAYMENT_PROOF_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error('payment-proofs: createSignedUrl failed:', error);
    return null;
  }
  return data.signedUrl;
}
