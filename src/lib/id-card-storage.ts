import { ID_CARDS_BUCKET, isIdCardPath, PAYMENT_PROOF_URL_TTL_SECONDS } from '@/lib/security';
import { ownedObjectExists, signOwnedObjectUrl, uploadOwnedObject } from '@/lib/private-uploads';

/**
 * Server-only access to the private `id-cards` Storage bucket (src/lib/private-uploads.ts). Import from API routes
 * only: never from a client component (the service-role key must stay on the server).
 */

/** Uploads a validated ID card photo to `path` (inside `ownerId`'s own folder) with the service role. */
export async function uploadIdCard(
  ownerId: string,
  path: string,
  body: Buffer,
  contentType: string
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  return uploadOwnedObject(ID_CARDS_BUCKET, path, isIdCardPath(path, ownerId), body, contentType);
}

/** True if the object exists AND the user can see it (the SELECT policy only shows a user their own folder). */
export async function idCardExists(accessToken: string, path: string): Promise<boolean> {
  return ownedObjectExists(ID_CARDS_BUCKET, accessToken, path);
}

/** Lifetime of the signed links staff get to view an ID card: the same short window as payment screenshots. */
export const ID_CARD_URL_TTL_SECONDS = PAYMENT_PROOF_URL_TTL_SECONDS;

/**
 * Short-lived signed URL for an ID card. Callers must have authorized the request (verifyRegistrationStaff) and
 * checked that `path` belongs to the registration's owner. Returns null when the service role isn't configured.
 */
export async function signIdCardUrl(path: string): Promise<string | null> {
  return signOwnedObjectUrl(ID_CARDS_BUCKET, path, ID_CARD_URL_TTL_SECONDS);
}
