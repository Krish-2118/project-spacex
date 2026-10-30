import { createClient } from '@supabase/supabase-js';

/**
 * Server-only access to the private Storage buckets that hold registrants' files (payment-proofs, id-cards). Import
 * from API routes only: never from a client component (the service-role key must stay on the server).
 *
 * Users have NO Storage INSERT policy on these buckets: a JWT plus the public key can't upload directly, so every file
 * goes through an API route (auth, rate limit, size and magic-byte checks) and is written here with the service role.
 * Existence checks still run AS THE SIGNED-IN USER, so Storage RLS only lets them see their own folder. Staff signed
 * URLs use the service role, after the route has checked the caller is Registration-Team/Admin.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

const noSession = { persistSession: false, autoRefreshToken: false };

function bucketAsUser(bucket: string, accessToken: string) {
  if (!supabaseUrl || !publishableKey) return null;
  return createClient(supabaseUrl, publishableKey, {
    auth: noSession,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  }).storage.from(bucket);
}

function bucketAsServiceRole(bucket: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey || !supabaseUrl) return null;
  return createClient(supabaseUrl, serviceKey, { auth: noSession }).storage.from(bucket);
}

/**
 * Uploads a validated file to `path` with the service role. Never overwrites an existing object. The service role
 * bypasses Storage RLS, so the caller must pass `pathIsOwned`, the own-folder / server-shaped-name check for `path`.
 */
export async function uploadOwnedObject(
  bucket: string,
  path: string,
  pathIsOwned: boolean,
  body: Buffer,
  contentType: string
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  if (!pathIsOwned) return { ok: false, error: new Error(`${bucket} path outside the owner folder`) };
  const storage = bucketAsServiceRole(bucket);
  if (!storage) return { ok: false, error: new Error('SUPABASE_SERVICE_ROLE_KEY is not configured') };
  const { error } = await storage.upload(path, body, { contentType, upsert: false });
  return error ? { ok: false, error } : { ok: true };
}

/** True if the object exists AND the user can see it (the SELECT policy only shows a user their own folder). */
export async function ownedObjectExists(bucket: string, accessToken: string, path: string): Promise<boolean> {
  const storage = bucketAsUser(bucket, accessToken);
  if (!storage) return false;
  const { data, error } = await storage.exists(path);
  return !error && data === true;
}

/**
 * Short-lived signed URL for a registrant's file. Callers must have authorized the request (verifyRegistrationStaff)
 * and checked that `path` belongs to the registration's owner. Returns null when the service role isn't configured.
 */
export async function signOwnedObjectUrl(bucket: string, path: string, ttlSeconds: number): Promise<string | null> {
  const storage = bucketAsServiceRole(bucket);
  if (!storage) return null;
  const { data, error } = await storage.createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) {
    console.error(`${bucket}: createSignedUrl failed:`, error);
    return null;
  }
  return data.signedUrl;
}
