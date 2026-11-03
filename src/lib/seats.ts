/**
 * The seat counter on the registration form and the registration phases (supabase/schema.sql, sections 17 and 20).
 * Client & server safe, and free of `@/` imports so it can be unit tested directly with `node --test`.
 *
 * Admins set both numbers in the admin dashboard; after that the database moves `left` by itself. When `left` reaches 0
 * the phase closes, and stays closed until an admin starts the next phase with a new fee and new numbers.
 */

/** Largest total an admin may set (matches registration_counter_seats_check). */
export const MAX_SEATS = 10000;

/** Largest fee an admin may set, in rupees (matches registration_counter_phase_check). */
export const MAX_FEE = 100000;

export interface SeatCount {
  total: number;
  left: number;
  closed: boolean;
  /** The female seat cap is reached (supabase/schema.sql, section 21): Female and Others show as FULL on the form. */
  femaleFull: boolean;
}

/**
 * Must not say "nothing was charged": a student seeing this may have paid with a saved QR or the UPI ID.
 * "Contact us" is the footer section that has the numbers.
 */
export const REGISTRATIONS_FULL_MESSAGE = "Registrations are closed. Already paid? Don't pay again: contact us with your UTR.";

/** Under the Gender options at the cap, and the server's refusal. The same rule as above about what it may not say. */
export const FEMALE_SEATS_FULL_MESSAGE =
  "Female and Others seats are full right now. A seat may open up if a registration is not approved, so check back later. Already paid? Don't pay again: contact us with your UTR.";

/** The refusal from trg_guard_female_seats (supabase/schema.sql, section 21). */
export function isFemaleSeatsFullError(err: { message?: string } | null | undefined): boolean {
  return /Female and Others seats are full/i.test(err?.message ?? '');
}

/** The Gender options as the form shows them: at the cap, Female and Others are marked full. */
export function genderChoices<T extends { value: string }>(options: readonly T[], capped: boolean): (T & { full: boolean })[] {
  return options.map((o) => ({ ...o, full: capped && (o.value === 'female' || o.value === 'others') }));
}

const isSeatNumber = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEATS;

/** The counter from a JSON body ({ total, left, closed, femaleFull }), or null if it isn't a valid one. */
export function parseSeatCount(value: unknown): SeatCount | null {
  if (!value || typeof value !== 'object') return null;
  const { total, left, closed, femaleFull } = value as Record<string, unknown>;
  if (!isSeatNumber(total) || !isSeatNumber(left) || left > total) return null;
  return { total, left, closed: closed === true || left === 0, femaleFull: femaleFull === true };
}

/** Why an admin's new numbers can't be saved, or null if they can. */
export function seatCountError(total: unknown, left: unknown): string | null {
  if (!isSeatNumber(total)) return `Total seats must be a whole number from 0 to ${MAX_SEATS}.`;
  if (!isSeatNumber(left)) return `Seats left must be a whole number from 0 to ${MAX_SEATS}.`;
  if (left > total) return 'Seats left cannot be more than the total.';
  return null;
}

export const isFee = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= MAX_FEE;

/** Why an admin's next phase can't be started, or null if it can. */
export function nextPhaseError(fee: unknown, total: unknown, left: unknown): string | null {
  if (!isFee(fee)) return `The fee must be a whole number of rupees from 1 to ${MAX_FEE}.`;
  const invalid = seatCountError(total, left);
  if (invalid) return invalid;
  if (left === 0) return 'A new phase needs at least one seat left.';
  return null;
}

/** 1300 → "1,300" (Indian digit grouping, the same as the rest of the site). */
export function formatSeats(n: number): string {
  return n.toLocaleString('en-IN');
}

/**
 * The public count (GET /api/seats), or null when it couldn't be read (offline, server error, or the counter isn't
 * set up yet): the form then hides the counter. For display only: POST /api/register/start-payment is what decides
 * whether a student may pay.
 */
export async function fetchSeatCount(): Promise<SeatCount | null> {
  try {
    const res = await fetch('/api/seats');
    if (!res.ok) return null;
    return parseSeatCount(await res.json());
  } catch {
    return null;
  }
}

/** What the form may show on the payment step (POST /api/register/start-payment). */
export interface PaymentOffer {
  /** 'pay': show the payment details. 'already_paid': no payment details, only offer to continue with the proof. */
  state: 'pay' | 'already_paid';
  amount: number;
  /** The fee of the phase open now, if there is one: an 'already_paid' student who hasn't paid can pay this instead. */
  currentFee: number | null;
}

/** The offer from a POST /api/register/start-payment response, or null if it isn't a valid one. */
export function parsePaymentOffer(value: unknown): PaymentOffer | null {
  if (!value || typeof value !== 'object') return null;
  const { state, amount, currentFee } = value as Record<string, unknown>;
  if ((state !== 'pay' && state !== 'already_paid') || !isFee(amount)) return null;
  return { state, amount, currentFee: isFee(currentFee) ? currentFee : null };
}
