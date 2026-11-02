/**
 * Registration payment details shown on the "Pay the fee" step of the registration form.
 *
 * The server never reads these. The fee isn't here: it belongs to the registration phase and the student's payment pass
 * in the database (supabase/schema.sql section 20), and reaches the form through POST /api/register/start-payment.
 *
 * The QR (UPI_QR_SRC) is the SBI merchant QR for this account. It encodes the payee with an empty amount (`am=`), so it
 * works at any fee, but the student types the amount in themselves: scan it to check before replacing it with another.
 */
/** Only for the review-only registration preview (REGISTRATION_PREVIEW_ENABLED), which never talks to the server. */
export const PREVIEW_REGISTRATION_FEE = 999;
export const UPI_ID = '85002429435@sbi';
export const UPI_PAYEE_NAME = 'PLAN FUND NIT ROURKELA';
export const UPI_NOTE = 'Innovision 2026 registration';

/**
 * `upi://pay` deep link: opens the student's UPI app with the payee, amount and note filled in. The VPA stays
 * unencoded (its characters are URL-safe, and some UPI apps reject `%40` in place of `@`).
 */
export const buildUpiPayLink = (amount: number) =>
  'upi://pay?pa=' + UPI_ID +
  '&pn=' + encodeURIComponent(UPI_PAYEE_NAME) +
  '&am=' + amount +
  '&cu=INR&tn=' + encodeURIComponent(UPI_NOTE);

/** Official SBI QR code standee in webp format. */
export const UPI_QR_SRC = '/assets/payment-qr.webp';
export const UPI_QR_CODE_SRC = '/assets/payment-qr-code.webp';
