import {
  AppError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableEntityError,
  ValidationError,
} from '../errors/AppError.js';
import { computeSeating } from './seating.js';
import { isSlotTooLate } from '../utils/hutTime.js';

function validateEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parsePositiveInt(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return n > 0 ? n : null;
  }
  return null;
}

/**
 * Only slotId and partySize are required (issue #6). The authenticated hiker's
 * name, email and phone are used as defaults, and may be overridden per booking.
 */
function validateBookingBody(body, hiker) {
  const details = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    details.push({ field: 'body', rule: 'invalid', message: 'Request body must be an object.' });
    throw new ValidationError('The request contains invalid fields.', 'VALIDATION_ERROR', details);
  }

  const allowed = ['slotId', 'partySize', 'contactName', 'email', 'phone'];
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      details.push({ field: key, rule: 'unknown', message: `${key} is not allowed.` });
    }
  }

  let slotId = null;
  if (body.slotId === undefined || body.slotId === null) {
    details.push({ field: 'slotId', rule: 'required', message: 'slotId is required.' });
  } else if (Number.isInteger(body.slotId) && body.slotId > 0) {
    slotId = body.slotId;
  } else {
    details.push({ field: 'slotId', rule: 'invalid', message: 'slotId is invalid.' });
  }

  let partySize = null;
  if (body.partySize === undefined || body.partySize === null) {
    details.push({ field: 'partySize', rule: 'required', message: 'partySize is required.' });
  } else if (Number.isInteger(body.partySize) && body.partySize > 0) {
    partySize = body.partySize;
  } else {
    details.push({ field: 'partySize', rule: 'invalid', message: 'partySize is invalid.' });
  }

  let contactName = hiker.displayName;
  if (body.contactName !== undefined && body.contactName !== null) {
    if (typeof body.contactName !== 'string' || body.contactName.trim() === '') {
      details.push({ field: 'contactName', rule: 'invalid', message: 'contactName is invalid.' });
    } else {
      contactName = body.contactName.trim();
    }
  }

  let email = hiker.email;
  if (body.email !== undefined && body.email !== null) {
    if (
      typeof body.email !== 'string' ||
      body.email.trim() === '' ||
      !validateEmail(body.email.trim())
    ) {
      details.push({ field: 'email', rule: 'invalid', message: 'email is invalid.' });
    } else {
      email = body.email.trim();
    }
  }

  let phone = hiker.phone ?? null;
  if (body.phone !== undefined && body.phone !== null) {
    if (typeof body.phone !== 'string') {
      details.push({ field: 'phone', rule: 'invalid', message: 'phone is invalid.' });
    } else {
      phone = body.phone.trim() === '' ? null : body.phone.trim();
    }
  }

  if (details.length > 0) {
    throw new ValidationError('The request contains invalid fields.', 'VALIDATION_ERROR', details);
  }

  return { slotId, partySize, contactName, email, phone };
}

function toBookingResponse(booking, assignments) {
  const split = assignments.length > 1;
  const response = {
    id: booking.id,
    status: booking.status,
    hikerId: booking.hiker_id,
    slot: {
      id: booking.slot_id,
      date: booking.slot_date,
      startTime: booking.slot_start_time,
      meal: booking.meal,
    },
    partySize: booking.party_size,
    contactName: booking.contact_name,
    email: booking.email,
    phone: booking.phone,
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
    async createBooking(hiker, body) {
      if (!hiker || !hiker.id) {
        throw new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED');
      }

      const data = validateBookingBody(body, hiker);
      let result;

      try {
        result = await db.transaction(async (tx) => {
          const slot = await slotDao.findById(tx, data.slotId);
          if (!slot) throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');

          if (slot.status !== 'available') {
            throw new ConflictError('Slot is not available.', 'SLOT_NOT_AVAILABLE');
          }

          if (isSlotTooLate(slot, { timeZone, now: now() })) {
            throw new UnprocessableEntityError(
              'Bookings close two hours before the slot starts.',
              'SLOT_TOO_LATE'
            );
          }

          const existing = await bookingDao.findConfirmedByHikerAndSlot(tx, hiker.id, slot.id);
          if (existing) {
            throw new ConflictError(
              'You already have a confirmed booking for this slot.',
              'BOOKING_ALREADY_EXISTS'
            );
          }

          const tables = await slotDao.getTablesWithFreeForSlot(tx, slot.id);
          const seating = computeSeating(data.partySize, tables);
          if (!seating) {
            throw new ConflictError('Insufficient capacity.', 'INSUFFICIENT_CAPACITY', []);
          }

          const bookingId = await bookingDao.create(tx, {
            slotId: slot.id,
            hikerId: hiker.id,
            createdBy: null,
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

      // A hiker can only read their own bookings. Staff roles can read any.
      if (user.role === 'hiker' && booking.hiker_id !== user.id) {
        throw new NotFoundError('Booking not found.', 'BOOKING_NOT_FOUND');
      }

      const assignments = await bookingDao.getSeatAssignments(booking.id);
      return toBookingResponse(booking, assignments);
    },
  };
}
