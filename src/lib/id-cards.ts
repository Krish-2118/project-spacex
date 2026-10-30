/**
 * College ID cards (supabase/schema.sql, section 19). Client & server safe, and free of `@/` imports so it can be unit
 * tested directly with `node --test`. Storage access is server-only: src/lib/id-card-storage.ts.
 *
 * Every registration needs a photo of the front of the registrant's college ID card before staff can approve it.
 * New registrants upload it in the form; earlier ones from MY PASS. Once uploaded it is fixed, unless staff ask for a
 * new one with one of these reasons, which the student sees on MY PASS.
 */

/** The values match registrations_id_card_reupload_reason_check in supabase/schema.sql. */
export const ID_CARD_REUPLOAD_REASONS = [
  {
    value: 'unclear_photo',
    label: 'Unclear photo',
    message: 'Your ID card photo was unclear. Upload a sharp photo of the front of the card, with your name and college readable.',
  },
  {
    value: 'not_an_id_card',
    label: 'Not an ID card',
    message: "The photo you uploaded wasn't your college ID card. Upload a photo of the front of your college ID card.",
  },
  {
    value: 'details_mismatch',
    label: "Details don't match",
    message: "The ID card doesn't match the name or college you registered with. Upload your own college ID card.",
  },
] as const;

export type IdCardReuploadReason = (typeof ID_CARD_REUPLOAD_REASONS)[number]['value'];

export function isIdCardReuploadReason(value: unknown): value is IdCardReuploadReason {
  return ID_CARD_REUPLOAD_REASONS.some((r) => r.value === value);
}

/** Short label for staff (admin dashboard). */
export function idCardReuploadLabel(reason: string | null | undefined): string {
  return ID_CARD_REUPLOAD_REASONS.find((r) => r.value === reason)?.label ?? '';
}

/** What the student is told to fix, or '' when staff didn't ask for a new card. */
export function idCardReuploadMessage(reason: string | null | undefined): string {
  return ID_CARD_REUPLOAD_REASONS.find((r) => r.value === reason)?.message ?? '';
}

/** Shown to staff who try to approve a registration without an ID card. */
export const ID_CARD_REQUIRED_ERROR =
  'This student has not uploaded their college ID card yet. They can upload it from MY PASS; approve after that.';

/** The database refused an approval because the registration has no ID card (trg_require_id_card_for_approval). */
export function isIdCardRequiredError(err: { message?: string } | null | undefined): boolean {
  return /ID card required before approval/i.test(err?.message ?? '');
}

/** Photos larger than this are shrunk in the browser before uploading (src/lib/compress-image.ts). */
export const ID_CARD_UPLOAD_TARGET_BYTES = 1024 * 1024;
