import { ConflictError, UnprocessableEntityError } from '../errors/AppError.js';
import { computeSeating } from './seating.js';
import { isSlotTooLate } from '../utils/hutTime.js';

/**
 * Rules shared by the booking (MH-01) and the seating preview, so both answer
 * the same way for the same slot.
 */

/** The slot takes bookings: it is switched on and starts at least two hours from now. */
export function assertSlotOpen(slot, { timeZone, now }) {
  if (slot.status !== 'available') {
    throw new ConflictError('Slot is not available.', 'SLOT_NOT_AVAILABLE');
  }
  if (isSlotTooLate(slot, { timeZone, now })) {
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
