import { AppError, ConflictError, NotFoundError } from '../errors/AppError.js';
import { isStaff } from '../auth/roles.js';
import { isTooLateToModify } from '../utils/hutTime.js';
import { assertSlotOpen, seatOrFail } from './bookingRules.js';

/**
 * Shared booking steps. Every story composes these instead of repeating them:
 *
 *   MH-01/05 hiker booking  loadOpenSlot → assertNoDuplicate → placeBooking
 *   MH-07 staff booking     loadOpenSlot(leadMs 0) → (resolve owner) → assertNoDuplicate → placeBooking
 *   MH-06 change            loadOwnedBooking → assertConfirmed → assertChangeAllowed
 *                           → reseat / bookingDao.replaceRequirements
 *   MH-08 cancel            loadOwnedBooking → assertConfirmed → cancel
 *
 * Steps that write take the transaction `tx` first and never send emails;
 * notifications are sent after the commit by bookingNotifier.js.
 */

/** The API shape of a booking (MH-01 response, MH-06 history, MH-03 view). */
export function toBookingResponse(booking, assignments, requirements = []) {
  const split = assignments.length > 1;

  const response = {
    id: booking.id,
    status: booking.status,
    hikerId: booking.hiker_id,
    createdBy: booking.created_by,
    slot: {
      id: booking.slot_id,
      date: booking.slot_date,
      startTime: booking.slot_start_time,
      endTime: booking.slot_end_time,
      meal: booking.meal,
    },
    partySize: booking.party_size,
    contactName: booking.contact_name,
    email: booking.email,
    contactNumber: booking.phone,
    requirements,
    split,
    seatAssignments: assignments.map((a) => ({
      tableId: a.tableId,
      tableLabel: a.tableLabel,
      seats: a.seats,
    })),
    createdAt: booking.created_at,
  };

  if (split) {
    response.notice = {
      code: 'GROUP_SPLIT',
      message: 'The group will be seated across multiple tables.',
    };
  }

  return response;
}

/**
 * Runs `fn` in a transaction. Business errors (AppError) pass through; any
 * other failure is reported as a generic 500 without leaking internals.
 */
export async function runInTransaction(db, fn) {
  try {
    return await db.transaction(fn);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(500, 'Internal Server Error', 'An unexpected error occurred.', 'INTERNAL_ERROR');
  }
}

export function createBookingCore({ bookingDao, slotDao, timeZone, now = () => new Date() }) {
  const bookingNotFound = () => new NotFoundError('Booking not found.', 'BOOKING_NOT_FOUND');

  async function loadSlot(tx, slotId) {
    const slot = await slotDao.findById(tx, slotId);
    if (!slot) throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');
    return slot;
  }

  return {
    loadSlot,

    /**
     * The slot exists and still takes bookings. Hikers need two hours' notice
     * (default); staff pass `leadMs: 0` and may book until the start (#35).
     */
    async loadOpenSlot(tx, slotId, { leadMs } = {}) {
      const slot = await loadSlot(tx, slotId);
      assertSlotOpen(slot, { timeZone, now: now(), ...(leadMs === undefined ? {} : { leadMs }) });
      return slot;
    },

    /** MH-06 (#43): changes need at least 48 hours before the slot starts. */
    assertChangeAllowed(slot) {
      if (isTooLateToModify(slot, { timeZone, now: now() })) {
        throw new ConflictError(
          'Bookings can only be changed up to 48 hours before the slot starts.',
          'TOO_LATE_TO_MODIFY'
        );
      }
    },

    /**
     * The booking, if `user` owns it (or is staff and `allowStaff` is set).
     * Anyone else gets 404, so booking ids of other hikers are not revealed.
     */
    async loadOwnedBooking(tx, bookingId, user, { allowStaff = false } = {}) {
      if (bookingId === null || bookingId === undefined) throw bookingNotFound();

      const booking = await bookingDao.findById(tx, bookingId);
      if (!booking) throw bookingNotFound();

      const owner = user?.id !== undefined && booking.hiker_id === user.id;
      if (!owner && !(allowStaff && isStaff(user))) throw bookingNotFound();

      return booking;
    },

    /** Only confirmed bookings can be changed (MH-06) or cancelled (MH-08). */
    assertConfirmed(booking, message = 'Only confirmed bookings can be changed.') {
      if (booking.status !== 'confirmed') {
        throw new ConflictError(message, 'BOOKING_NOT_CONFIRMED');
      }
    },

    /** Issue #25: one confirmed booking per hiker and slot. */
    async assertNoDuplicate(
      tx,
      hikerId,
      slotId,
      {
        exceptBookingId = null,
        message = 'You already have a confirmed booking for this slot.',
      } = {}
    ) {
      const existing = await bookingDao.findConfirmedByHikerAndSlot(tx, hikerId, slotId);
      if (existing && existing.id !== exceptBookingId) {
        throw new ConflictError(message, 'BOOKING_ALREADY_EXISTS');
      }
    },

    /**
     * MH-01 seating + MH-05 requirements for a new booking. Exactly one of
     * `hikerId` (hiker books, or staff books for an account) and `createdBy`
     * (staff) identifies who made it; `contact` is stored on the booking.
     * @returns {{ bookingId: number, assignments: Array }}
     */
    async placeBooking(tx, { slot, hikerId = null, createdBy = null, partySize, contact, requirements }) {
      const tables = await slotDao.getTablesWithFreeForSlot(tx, slot.id);
      const seating = seatOrFail(partySize, tables);

      const bookingId = await bookingDao.create(tx, {
        slotId: slot.id,
        hikerId,
        createdBy,
        partySize,
        contactName: contact?.contactName ?? null,
        email: contact?.email ?? null,
        phone: contact?.phone ?? null,
      });

      await bookingDao.insertSeats(tx, bookingId, seating.assignments);
      await bookingDao.insertRequirements(tx, bookingId, requirements);

      return { bookingId, assignments: seating.assignments };
    },

    /**
     * MH-06 (#38): seat the booking again in `slot` for `partySize` with the
     * MH-01 rules. Its current seats are released first, so they count as free.
     * If the party does not fit, seatOrFail throws and the caller's transaction
     * rolls back: the booking keeps its previous seats.
     * @returns the new seat assignments
     */
    async reseat(tx, booking, { slot, partySize, expectedSeating }) {
      await bookingDao.deleteSeats(tx, booking.id);

      const tables = await slotDao.getTablesWithFreeForSlot(tx, slot.id);
      const seating = seatOrFail(partySize, tables);

      if (expectedSeating === 'single_table' && seating.fit === 'split') {
        throw new ConflictError('Seating has changed. Please review the split arrangement before saving.', 'SEATING_CHANGED');
      }

      await bookingDao.update(tx, booking.id, { slotId: slot.id, partySize });
      await bookingDao.insertSeats(tx, booking.id, seating.assignments);

      return seating.assignments;
    },

    /**
     * MH-08: mark the booking cancelled. Returns true when this call changed the
     * status, false when it was already cancelled (idempotent repeat). The seats
     * are kept for history; free-seat queries only count confirmed bookings.
     */
    async cancel(tx, booking) {
      return bookingDao.cancelIfConfirmed(tx, booking.id);
    },

    /**
     * Reads a booking with its seats and requirements and returns
     * `{ booking, view }` (`view` is the API response). Pass `assignments`
     * when they were just computed, to skip reading them again.
     */
    async loadBookingView(exec, bookingId, { assignments } = {}) {
      const booking = await bookingDao.findById(exec, bookingId);
      const seats = assignments ?? (await bookingDao.getSeatAssignments(exec, bookingId));
      const requirements = await bookingDao.getRequirements(exec, bookingId);
      return { booking, view: toBookingResponse(booking, seats, requirements) };
    },
  };
}
