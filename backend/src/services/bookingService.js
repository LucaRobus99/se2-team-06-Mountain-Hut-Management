import { NotFoundError, ConflictError, UnprocessableEntityError, ValidationError, AppError } from '../errors/AppError.js';
import { computeSeating } from './seating.js';

function validateEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateBookingBody(body) {
  const details = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    details.push({ field: 'body', rule: 'invalid', message: 'Request body must be an object.' });
    throw new ValidationError('The request contains invalid fields.', 'VALIDATION_ERROR', details);
  }
  const allowed = ['slotId', 'partySize', 'contactName', 'email', 'phone', 'acceptSplit'];
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      details.push({ field: key, rule: 'unknown', message: `${key} is not allowed.` });
    }
  }

  // slotId (JSON integer, not a numeric string)
  let slotId = null;
  if (body.slotId === undefined || body.slotId === null) {
    details.push({ field: 'slotId', rule: 'required', message: 'slotId is required.' });
  } else if (Number.isInteger(body.slotId) && body.slotId > 0) {
    slotId = body.slotId;
  } else {
    details.push({ field: 'slotId', rule: 'invalid', message: 'slotId is invalid.' });
  }

  // partySize (JSON integer, not a numeric string)
  let partySize = null;
  if (body.partySize === undefined || body.partySize === null) {
    details.push({ field: 'partySize', rule: 'required', message: 'partySize is required.' });
  } else if (Number.isInteger(body.partySize) && body.partySize > 0) {
    partySize = body.partySize;
  } else {
    details.push({ field: 'partySize', rule: 'invalid', message: 'partySize is invalid.' });
  }

  // contactName
  const contactName = body.contactName;
  if (contactName === undefined || contactName === null) {
    details.push({ field: 'contactName', rule: 'required', message: 'contactName is required.' });
  } else if (typeof contactName !== 'string' || contactName.trim() === '') {
    details.push({ field: 'contactName', rule: 'invalid', message: 'contactName is invalid.' });
  }

  // email
  const email = body.email;
  if (email === undefined || email === null) {
    details.push({ field: 'email', rule: 'required', message: 'email is required.' });
  } else if (typeof email !== 'string' || email.trim() === '' || !validateEmail(email.trim())) {
    details.push({ field: 'email', rule: 'invalid', message: 'email is invalid.' });
  }

  // phone optional
  let phone = null;
  if (body.phone !== undefined && body.phone !== null) {
    if (typeof body.phone !== 'string') {
      details.push({ field: 'phone', rule: 'invalid', message: 'phone is invalid.' });
    } else {
      phone = body.phone.trim() === '' ? null : body.phone.trim();
    }
  }

  // acceptSplit optional boolean
  let acceptSplit = body.acceptSplit;
  if (acceptSplit !== undefined && acceptSplit !== null && typeof acceptSplit !== 'boolean') {
    details.push({ field: 'acceptSplit', rule: 'invalid', message: 'acceptSplit is invalid.' });
    acceptSplit = undefined;
  }

  if (details.length > 0) {
    throw new ValidationError('The request contains invalid fields.', 'VALIDATION_ERROR', details);
  }

  return {
    slotId,
    partySize,
    contactName: contactName.trim(),
    email: email.trim(),
    phone,
    acceptSplit: acceptSplit === true,
  };
}

function isPastSlot(slot) {
  const now = new Date();
  const slotDate = new Date(`${slot.date}T${slot.start_time}:00`);
  return slotDate.getTime() <= now.getTime();
}

export function createBookingService({ db, bookingDao, slotDao }) {
  return {
    async createBooking(body) {
      const data = validateBookingBody(body);

      let result;
      try {
        result = await db.transaction(async (tx) => {
          const slot = await slotDao.findById(tx, data.slotId);
          if (!slot) throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');

          if (slot.status !== 'available') {
            throw new ConflictError('Slot is not available.', 'SLOT_NOT_AVAILABLE');
          }

          const tables = await slotDao.getTablesForSlot(tx, slot.id);
          const freeMap = await slotDao.getFreeSeats(tx, slot.id);
          const tablesWithFree = tables.map((t) => ({
            id: t.id,
            label: t.label,
            seats: t.seats,
            free: freeMap instanceof Map ? (freeMap.get(t.id) ?? t.seats) : (freeMap?.[t.id] ?? t.seats),
          }));

          const seating = computeSeating(data.partySize, tablesWithFree);
          if (!seating) {
            throw new ConflictError('Insufficient capacity.', 'INSUFFICIENT_CAPACITY', []);
          }

          if (seating.fit === 'split' && !data.acceptSplit) {
            throw new ConflictError('Split not accepted.', 'SPLIT_NOT_ACCEPTED');
          }

          if (isPastSlot(slot)) {
            throw new UnprocessableEntityError('Slot is in the past.', 'SLOT_IN_THE_PAST');
          }

          const bookingId = await bookingDao.create(tx, {
            slotId: slot.id,
            partySize: data.partySize,
            contactName: data.contactName,
            email: data.email,
            phone: data.phone,
          });
          await bookingDao.insertSeats(tx, bookingId, seating.assignments);
          const createdAt = await bookingDao.getCreatedAt(tx, bookingId);

          return { id: bookingId, slot, seating, createdAt };
        });
      } catch (err) {
        if (err instanceof ValidationError || err instanceof NotFoundError ||
            err instanceof ConflictError || err instanceof UnprocessableEntityError) {
          throw err;
        }
        throw new AppError(500, 'Internal Server Error', 'An unexpected error occurred.', 'INTERNAL_ERROR');
      }

      const { id, slot, seating, createdAt } = result;
      const split = seating.fit === 'split';
      const response = {
        id,
        status: 'confirmed',
        slot: {
          id: slot.id,
          date: slot.date,
          startTime: slot.start_time,
          meal: slot.meal,
        },
        partySize: data.partySize,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        split,
        seatAssignments: seating.assignments,
        createdAt,
      };
      if (split) {
        response.notice = {
          code: 'GROUP_SPLIT',
          message: 'The group will be seated across multiple tables.',
        };
      }
      return response;
    },
  };
}