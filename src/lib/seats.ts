/**
 * The seat counter on the registration form (supabase/schema.sql, section 17). Client & server safe, and free of `@/`
 * imports so it can be unit tested directly with `node --test`.
 *
 * Admins set both numbers in the admin dashboard; after that the database moves `left` by itself (a registration
 * takes a seat, a rejection gives it back). The form stops before the payment step once `left` is 0.
 */

/** Largest total an admin may set (matches registration_counter_seats_check). */
export const MAX_SEATS = 10000;

export interface SeatCount {
  total: number;
  left: number;
}

export const SEATS_FULL_MESSAGE =
  'Registrations are full: every seat has been taken. Nothing was charged; please keep checking this page in case seats open up.';

const isSeatNumber = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEATS;

/** The counter from a JSON body ({ total, left }), or null if it isn't a valid one. */
export function parseSeatCount(value: unknown): SeatCount | null {
  if (!value || typeof value !== 'object') return null;
  const { total, left } = value as Record<string, unknown>;
  if (!isSeatNumber(total) || !isSeatNumber(left) || left > total) return null;
  return { total, left };
}

/** Why an admin's new numbers can't be saved, or null if they can. */
export function seatCountError(total: unknown, left: unknown): string | null {
  if (!isSeatNumber(total)) return `Total seats must be a whole number from 0 to ${MAX_SEATS}.`;
  if (!isSeatNumber(left)) return `Seats left must be a whole number from 0 to ${MAX_SEATS}.`;
  if (left > total) return 'Seats left cannot be more than the total.';
  return null;
}

/** 1300 → "1,300" (Indian digit grouping, the same as the rest of the site). */
export function formatSeats(n: number): string {
  return n.toLocaleString('en-IN');
}

/**
 * The public count (GET /api/seats), or null when it couldn't be read (offline, server error, or the counter isn't
 * set up yet): the form then hides the counter and lets the student carry on.
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
