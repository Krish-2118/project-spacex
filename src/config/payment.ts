/**
 * Registration payment details shown on the "Pay the fee" step of the registration form.
 *
 * The server never reads these: POST /api/register always records REGISTRATION_FEE_INR from src/lib/security.ts.
 * Keep REGISTRATION_FEE in step with it (a unit test checks they match).
 *
 * public/assets/upi-qr.svg is currently a non-scannable "PAYMENT QR / COMING SOON" placeholder; the organisers will
 * supply the real QR (and its UPI ID and payee name, which must replace the values below) before registrations open.
 *
 * The real QR must encode UPI_PAY_LINK. If the UPI ID, payee name or fee changes, regenerate it from the new
 * link as ONE byte-mode segment, error correction M, e.g. with the `qrcode` package:
 *   QRCode.toString([{ data: UPI_PAY_LINK, mode: 'byte' }], { type: 'svg', errorCorrectionLevel: 'M', margin: 1,
 *     color: { dark: '#0c0b0aff', light: '#ECE8DFff' } })
 * Left to pick its own segments, `qrcode` splits the link into byte + numeric + byte around the fee, and that
 * symbol fails to decode in ZXing (the reader behind many Android apps). Check it scans to the new link.
 */
export const REGISTRATION_FEE = 999;
export const UPI_ID = '85002429435@sbi';
export const UPI_PAYEE_NAME = 'PLAN FUND NIT ROURKELA';
export const UPI_NOTE = 'Innovision 2026 registration';

/**
 * `upi://pay` deep link: opens the student's UPI app with the payee, amount and note filled in. The VPA stays
 * unencoded (its characters are URL-safe, and some UPI apps reject `%40` in place of `@`).
 */
export const UPI_PAY_LINK =
  'upi://pay?pa=' + UPI_ID +
  '&pn=' + encodeURIComponent(UPI_PAYEE_NAME) +
  '&am=' + REGISTRATION_FEE +
  '&cu=INR&tn=' + encodeURIComponent(UPI_NOTE);

/** Official SBI QR code standee in webp format. */
export const UPI_QR_SRC = '/assets/payment-qr.webp';
export const UPI_QR_CODE_SRC = '/assets/payment-qr-code.webp';
