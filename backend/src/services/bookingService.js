import { AppError, ConflictError, NotFoundError, UnauthorizedError } from '../errors/AppError.js';
import { assertSlotOpen, seatOrFail } from './bookingRules.js';
import { isStaff } from '../auth/roles.js';
import {
  EXPECTED,
  invalid,
  invalidFields,
  isMissing,
  isPositiveInt,
  isValidEmail,
  parsePositiveInt,
  required,
  tooLong,
  unknown,
} from '../utils/validation.js';

const CONTACT_FIELDS = ['contactName', 'email', 'contactNumber'];

/**
 * Optional contact text: null when not sent, the trimmed string when valid,
 * otherwise a detail is added and undefined is returned.
 */
function optionalText(body, field, maxLength, details, isValid = () => true, expected = EXPECTED.text) {
  const value = body[field];
  if (isMissing(value)) return null;
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '' || !isValid(text)) {
    details.push(invalid(field, expected));
    return undefined;
  }
  if (text.length > maxLength) {
    details.push(tooLong(field, maxLength));
    return undefined;
  }
  return text;
}

/**
 * Only slotId and partySize are required (issue #6).
 * - Hiker: the contact details come from the hiker's profile, so the request
 *   may not send any.
 * - Staff booking for a guest: the request sends the guest's contact details,
 *   at least one of contactName, email or contactNumber.
 */
function validateBookingBody(body, user) {
  const details = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidFields([invalid('body', EXPECTED.object)]);
  }

  const staff = isStaff(user);
  const allowed = staff ? ['slotId', 'partySize', ...CONTACT_FIELDS] : ['slotId', 'partySize'];
  for (const key of Object.keys(body)) {
    if (allowed.includes(key)) continue;
    if (CONTACT_FIELDS.includes(key)) {
      details.push({ field: key, rule: 'not_allowed', message: 'Contact details are taken from your hiker profile.' });
    } else {
      details.push(unknown(key));
    }
  }

  let slotId = null;
  if (isMissing(body.slotId)) {
    details.push(required('slotId'));
  } else if (isPositiveInt(body.slotId)) {
    slotId = body.slotId;
  } else {
    details.push(invalid('slotId', EXPECTED.positiveInt));
  }

  let partySize = null;
  if (isMissing(body.partySize)) {
    details.push(required('partySize'));
  } else if (isPositiveInt(body.partySize)) {
    partySize = body.partySize;
  } else {
    details.push(invalid('partySize', EXPECTED.positiveInt));
  }

  let contact = { contactName: user.displayName ?? null, email: user.email ?? null, phone: user.phone ?? null };
  if (staff) {
    contact = {
      contactName: optionalText(body, 'contactName', 100, details),
      email: optionalText(body, 'email', 255, details, isValidEmail, EXPECTED.email),
      phone: optionalText(body, 'contactNumber', 30, details),
    };
    if (CONTACT_FIELDS.every((field) => isMissing(body[field]))) {
      details.push({
        field: 'contact',
        rule: 'required',
        message: 'Provide at least one of contactName, email or contactNumber.',
      });
    }
  }

  if (details.length > 0) throw invalidFields(details);

  return { slotId, partySize, ...contact };
}

function toBookingResponse(booking, assignments) {
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

export function createBookingService({ db, bookingDao, slotDao, timeZone, now = () => new Date() }) {
  return {
    /**
     * A hiker books for themself (hiker_id). Staff book on someone's behalf
     * (created_by).
     */
    async createBooking(user, body) {
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED');
      }

      const staff = isStaff(user);
      const data = validateBookingBody(body, user);
      let result;

      try {
        result = await db.transaction(async (tx) => {
          const slot = await slotDao.findById(tx, data.slotId);
          if (!slot) {
            throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');
          }

          assertSlotOpen(slot, { timeZone, now: now() });

          // Issue #25 limits hikers to one booking per slot; staff may book for several parties.
          if (!staff) {
            const existing = await bookingDao.findConfirmedByHikerAndSlot(tx, user.id, slot.id);
            if (existing) {
              throw new ConflictError(
                'You already have a confirmed booking for this slot.',
                'BOOKING_ALREADY_EXISTS'
              );
            }
          }

          const tables = await slotDao.getTablesWithFreeForSlot(tx, slot.id);
          const seating = seatOrFail(data.partySize, tables);

          const bookingId = await bookingDao.create(tx, {
            slotId: slot.id,
            hikerId: staff ? null : user.id,
            createdBy: staff ? user.id : null,
            partySize: data.partySize,
            contactName: data.contactName,
            email: data.email,
            phone: data.phone,
          });
          await bookingDao.insertSeats(tx, bookingId, seating.assignments);
          const booking = await bookingDao.findById(tx, bookingId);

          return { booking, assignments: seating.assignments };
        });
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(500, 'Internal Server Error', 'An unexpected error occurred.', 'INTERNAL_ERROR');
      }

      return toBookingResponse(result.booking, result.assignments);
    },

    async getBooking(bookingIdRaw, user) {
      const bookingId = parsePositiveInt(bookingIdRaw);
      if (bookingId === null) throw new NotFoundError('Booking not found.', 'BOOKING_NOT_FOUND');

      const booking = await bookingDao.findById(bookingId);
      if (!booking) throw new NotFoundError('Booking not found.', 'BOOKING_NOT_FOUND');

      // Staff read every booking; a hiker reads only their own bookings.
      const allowed = isStaff(user) || booking.hiker_id === user.id;
      if (!allowed) {
        throw new NotFoundError('Booking not found.', 'BOOKING_NOT_FOUND');
      }

      const assignments = await bookingDao.getSeatAssignments(booking.id);
      return toBookingResponse(booking, assignments);
    },
  };
}
