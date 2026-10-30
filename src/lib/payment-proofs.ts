import { isPaymentProofPath, PAYMENT_PROOFS_BUCKET, PAYMENT_PROOF_URL_TTL_SECONDS } from '@/lib/security';
import { ownedObjectExists, signOwnedObjectUrl, uploadOwnedObject } from '@/lib/private-uploads';

/**
 * Server-only access to the private `payment-proofs` Storage bucket (src/lib/private-uploads.ts). Import from API
 * routes only: never from a client component (the service-role key must stay on the server).
 */

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
  return uploadOwnedObject(PAYMENT_PROOFS_BUCKET, path, isPaymentProofPath(path, ownerId), body, contentType);
}

/** True if the object exists AND the user can see it (the SELECT policy only shows a user their own folder). */
export async function paymentProofExists(accessToken: string, path: string): Promise<boolean> {
  return ownedObjectExists(PAYMENT_PROOFS_BUCKET, accessToken, path);
}

/**
 * Short-lived signed URL for a payment screenshot. Callers must have authorized the request (verifyRegistrationStaff) and
 * checked that `path` belongs to the registration's owner. Returns null when the service role isn't configured.
 */
export async function signPaymentProofUrl(path: string): Promise<string | null> {
  return signOwnedObjectUrl(PAYMENT_PROOFS_BUCKET, path, PAYMENT_PROOF_URL_TTL_SECONDS);
}
