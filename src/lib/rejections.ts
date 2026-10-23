/**
 * Rejections and registering again (supabase/schema.sql, section 17). Client & server safe, and free of `@/` imports
 * so it can be unit tested directly with `node --test`.
 *
 * Staff pick a reason with every rejection; the student sees it on their pass with a REGISTER AGAIN button, until the
 * account has used MAX_REGISTRATION_ATTEMPTS registrations.
 */

/** Registrations one account may make in all (matches guard_registration_attempts in supabase/schema.sql). */
export const MAX_REGISTRATION_ATTEMPTS = 3;

/** The values match registrations_rejection_reason_check in supabase/schema.sql. */
export const REJECTION_REASONS = [
  {
    value: 'unclear_screenshot',
    label: 'Unclear screenshot',
    message: 'The payment screenshot was unclear or did not show the payment. Upload a clear screenshot of the payment success screen.',
  },
  {
    value: 'utr_mismatch',
    label: "UTR doesn't match",
    message: "The UTR you entered doesn't match the payment. Copy the 12-digit UTR from the payment details in your UPI app.",
  },
  {
    value: 'wrong_amount',
    label: 'Wrong amount',
    message: 'The amount paid was not the registration fee. Pay the exact fee shown on the payment step.',
  },
  {
    value: 'duplicate_payment',
    label: 'Duplicate payment',
    message: 'This payment was already used for another registration. Each registration needs its own payment.',
  },
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number]['value'];

export function isRejectionReason(value: unknown): value is RejectionReason {
  return REJECTION_REASONS.some((r) => r.value === value);
}

/** Short label for staff (admin dashboard). */
export function rejectionLabel(reason: string | null | undefined): string {
  return REJECTION_REASONS.find((r) => r.value === reason)?.label ?? '';
}

/** What the student is told to fix, or '' for a rejection without a reason (made before reasons existed). */
export function rejectionMessage(reason: string | null | undefined): string {
  return REJECTION_REASONS.find((r) => r.value === reason)?.message ?? '';
}

/** Registrations still allowed after `rejected` rejections (never negative). */
export function attemptsLeft(rejected: number): number {
  return Math.max(MAX_REGISTRATION_ATTEMPTS - rejected, 0);
}

export const ATTEMPTS_USED_UP_ERROR =
  `This account has been rejected ${MAX_REGISTRATION_ATTEMPTS} times and can't register again. Please contact the registration helpdesk.`;

/** The database refused a registration because the account has no attempts left (trg_guard_registration_attempts). */
export function isAttemptsUsedUpError(err: { message?: string } | null | undefined): boolean {
  return /registration attempts used up/i.test(err?.message ?? '');
}

/** "2nd", "3rd": the attempt number staff see on a registration made again after a rejection. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}
