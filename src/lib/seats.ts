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
  /** Male students may still choose accommodation (supabase/schema.sql, section 22). Admins close it. */
  maleAccommodationOpen: boolean;
}

/**
 * Must not say "nothing was charged": a student seeing this may have paid with a saved QR or the UPI ID.
 * "Contact us" is the footer section that has the numbers.
 */
export const REGISTRATIONS_FULL_MESSAGE = "Registrations are closed. Already paid? Don't pay again: contact us with your UTR.";

/** A Male student asked for accommodation after an admin closed it. */
export const MALE_ACCOMMODATION_CLOSED_MESSAGE =
  'Accommodation is no longer available for new registrations. Tick NO ACCOMMODATION to continue.';

/**
 * A form from before accommodation was added: it never told the student whether theirs is included, so nothing is accepted
 * until it has been refreshed. The same rule as above about what it may not say.
 */
export const FORM_OUT_OF_DATE_MESSAGE = "This form is out of date. Refresh the page to continue. Already paid? Don't pay again.";

/** A refusal from trg_guard_registration_accommodation (supabase/schema.sql, section 22). */
export function isAccommodationRefusal(err: { message?: string } | null | undefined): boolean {
  return /Female and Others seats are full|Male accommodation is closed/i.test(err?.message ?? '');
}

/** The NO ACCOMMODATION box on the form. `maleTicked` is what a Male student chose, kept for when it opens again. */
export function accommodationBox(gender: string, maleOpen: boolean, maleTicked: boolean): { checked: boolean; locked: boolean; note: string } {
  if (gender === 'female' || gender === 'others' || (gender === 'male' && !maleOpen)) {
    return { checked: true, locked: true, note: "This registration doesn't include accommodation." };
  }
  if (gender === 'male') {
    return { checked: maleTicked, locked: false, note: "Tick this if you don't need accommodation. The fee stays the same." };
  }
  return { checked: false, locked: true, note: 'Select your gender first.' };
}

/** What the form sends for the box: a disabled box still has its ticked state, so this doesn't depend on it for Female or Others. */
export function formNoAccommodation(gender: string, boxChecked: boolean): boolean {
  return gender !== 'male' || boxChecked;
}

/**
 * Whether a new registration includes accommodation, for POST /api/register, from what the form sent (`noAccommodation`,
 * null from a form too old to send it) and resolve_registration_payment. The decision saved on the pass wins: it is what
 * the student was shown. Null means ask the student to refresh: their form never told them.
 */
export function accommodationForSubmit(
  gender: string,
  noAccommodation: boolean | null,
  payment: { pass_id?: unknown; pass_accommodation?: boolean | null; male_accommodation_open?: boolean }
): boolean | null {
  if (gender !== 'male') return noAccommodation === true ? false : null;
  if (typeof payment.pass_accommodation === 'boolean') return payment.pass_accommodation;
  if (noAccommodation === true) return false;
  // A pass from before this existed was quoted with accommodation, as was an old form with no pass while it's open.
  return payment.pass_id || payment.male_accommodation_open !== false ? true : null;
}

const isSeatNumber = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEATS;

/** The counter from a JSON body ({ total, left, closed, maleAccommodationOpen }), or null if it isn't a valid one. */
export function parseSeatCount(value: unknown): SeatCount | null {
  if (!value || typeof value !== 'object') return null;
  const { total, left, closed, maleAccommodationOpen } = value as Record<string, unknown>;
  if (!isSeatNumber(total) || !isSeatNumber(left) || left > total) return null;
  return { total, left, closed: closed === true || left === 0, maleAccommodationOpen: maleAccommodationOpen !== false };
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
  /** Whether this registration includes accommodation: the form shows this before the payment details. */
  accommodation: boolean;
}

/** The offer from a POST /api/register/start-payment response, or null if it isn't a valid one. */
export function parsePaymentOffer(value: unknown): PaymentOffer | null {
  if (!value || typeof value !== 'object') return null;
  const { state, amount, currentFee, accommodation } = value as Record<string, unknown>;
  if ((state !== 'pay' && state !== 'already_paid') || !isFee(amount) || typeof accommodation !== 'boolean') return null;
  return { state, amount, currentFee: isFee(currentFee) ? currentFee : null, accommodation };
}
