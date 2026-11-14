import { ConflictError, UnprocessableEntityError } from '../errors/AppError.js';
import { computeSeating } from './seating.js';
import { isSlotTooLate } from '../utils/hutTime.js';

/**
 * Rules shared by the booking (MH-01) and the seating preview, so both answer
 * the same way for the same slot.
 */

/**
 * The slot takes bookings: it is switched on and has not started yet.
 *
 * Hikers must book at least two hours ahead (default `BOOKING_LEAD_MS`).
 * MH-07 (#35): staff may book until the slot starts, so the staff paths pass
 * `leadMs: 0`; once the slot has started the request is rejected with
 * SLOT_ALREADY_STARTED.
 */
export function assertSlotOpen(slot, { timeZone, now, leadMs } = {}) {
  if (slot.status !== 'available') {
    throw new ConflictError('Slot is not available.', 'SLOT_NOT_AVAILABLE');
  }

  const lateOptions = leadMs === undefined ? { timeZone, now } : { timeZone, now, leadMs };

  if (isSlotTooLate(slot, lateOptions)) {
    if (leadMs === 0) {
      throw new UnprocessableEntityError('This slot has already started.', 'SLOT_ALREADY_STARTED');
    }
    throw new UnprocessableEntityError('Bookings close two hours before the slot starts.', 'SLOT_TOO_LATE');
  }
}

/** Where the party sits in the slot's tables, or 409 when it does not fit. */
export function seatOrFail(partySize, tables) {
  const seating = computeSeating(partySize, tables);
  if (!seating) {
    throw new ConflictError('Insufficient capacity.', 'INSUFFICIENT_CAPACITY', []);
  }
  return seating;
}
