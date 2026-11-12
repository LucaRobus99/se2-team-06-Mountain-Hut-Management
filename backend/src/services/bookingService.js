
import { AppError, ConflictError, NotFoundError, UnauthorizedError } from '../errors/AppError.js';
import { assertSlotOpen, seatOrFail } from './bookingRules.js';
import { isStaff } from '../auth/roles.js';
import { isTooLateToModify } from '../utils/hutTime.js';
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

const INSERT_REQUIREMENT_METHODS = [
  'insertRequirements',
  'insertPartyRequirements',
  'insertBookingRequirements',
  'createRequirements',
  'createPartyRequirements',
  'createBookingRequirements',
  'addRequirements',
  'addPartyRequirements',
  'saveRequirements',
  'savePartyRequirements',
  'storeRequirements',
];

const GET_REQUIREMENT_METHODS = [
  'getRequirements',
  'getPartyRequirements',
  'getBookingRequirements',
  'findRequirements',
  'findRequirementsByBookingId',
  'findPartyRequirements',
  'findBookingRequirements',
  'listRequirements',
  'loadRequirements',
  'getRequirementsByBookingId',
  'fetchRequirements',
];

function findMethod(dao, names, predicate) {
  for (const name of names) {
    if (typeof dao?.[name] === 'function') {
      return dao[name].bind(dao);
    }
  }

  if (dao) {
    for (const key of Object.keys(dao)) {
      if (typeof dao[key] !== 'function') continue;
      if (!/requirement/i.test(key)) continue;
      if (predicate && !predicate(key)) continue;

      return dao[key].bind(dao);
    }
  }

  return null;
}

function findInserter(dao) {
  return findMethod(
    dao,
    INSERT_REQUIREMENT_METHODS,
    (key) => /insert|create|add|save|store/i.test(key)
  );
}

function findGetter(dao) {
  return findMethod(
    dao,
    GET_REQUIREMENT_METHODS,
    (key) => /get|find|list|load|fetch/i.test(key)
  );
}

function normalizeRequirements(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.map((r) => ({
    description: r?.description ?? r?.text ?? '',
    allergies:
      r?.allergies === true ||
      r?.allergies === 1 ||
      r?.allergies === 'true' ||
      r?.allergies === '1',
  }));
}

/**
 * Optional contact text: null when not sent, the trimmed string when valid,
 * otherwise a detail is added and undefined is returned.
 */
function optionalText(
  body,
  field,
  maxLength,
  details,
  isValid = () => true,
  expected = EXPECTED.text
) {
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
 * - Hiker: contact details come from the hiker's profile.
 * - Staff: contact details refer to the guest and at least one is required.
 */
function validateBookingBody(body, user) {
  const details = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidFields([invalid('body', EXPECTED.object)]);
  }

  const staff = isStaff(user);

  const allowed = staff
    ? ['slotId', 'partySize', ...CONTACT_FIELDS, 'requirements']
    : ['slotId', 'partySize', 'requirements'];

  for (const key of Object.keys(body)) {
    if (allowed.includes(key)) continue;

    if (CONTACT_FIELDS.includes(key)) {
      details.push({
        field: key,
        rule: 'not_allowed',
        message: 'Contact details are taken from your hiker profile.',
      });
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

  let contact = {
    contactName: user.displayName ?? null,
    email: user.email ?? null,
    phone: user.phone ?? null,
  };

  let requirements = [];

  if (!isMissing(body.requirements)) {
    if (!Array.isArray(body.requirements)) {
      details.push(invalid('requirements', EXPECTED.array));
    } else {
      const normalized = [];

      for (const entry of body.requirements) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          details.push(invalid('requirements', EXPECTED.object));
          continue;
        }

        const rawDesc = entry.description;
        let descValid = true;

        if (typeof rawDesc !== 'string' || rawDesc.trim() === '') {
          details.push(invalid('requirements', EXPECTED.text));
          descValid = false;
        } else if (rawDesc.trim().length > 500) {
          details.push(tooLong('requirements', 500));
          descValid = false;
        }

        const allergyValid = typeof entry.allergies === 'boolean';

        if (!allergyValid) {
          details.push(invalid('requirements', 'a boolean'));
        }

        if (descValid && allergyValid) {
          normalized.push({
            description: rawDesc.trim(),
            allergies: entry.allergies,
          });
        }
      }

      if (details.every((d) => !String(d.field || '').startsWith('requirements'))) {
        requirements = normalized;
      }
    }
  }

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

  if (details.length > 0) {
    throw invalidFields(details);
  }

  return { slotId, partySize, ...contact, requirements };
}

/**
 * MH-06: validate a partial update payload.
 * At least one of slotId, partySize or requirements must be present.
 * An explicit empty requirements array clears the previous requirements.
 */
function validateUpdateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidFields([invalid('body', EXPECTED.object)]);
  }

  const details = [];

  for (const key of Object.keys(body)) {
    if (!['slotId', 'partySize', 'requirements'].includes(key)) {
      details.push(unknown(key));
    }
  }

  const hasSlotId = !isMissing(body.slotId);
  const hasPartySize = !isMissing(body.partySize);
  const hasRequirements =
    Object.prototype.hasOwnProperty.call(body, 'requirements') &&
    !isMissing(body.requirements);

  let slotId = null;

  if (hasSlotId) {
    if (isPositiveInt(body.slotId)) {
      slotId = body.slotId;
    } else {
      details.push(invalid('slotId', EXPECTED.positiveInt));
    }
  }

  let partySize = null;

  if (hasPartySize) {
    if (isPositiveInt(body.partySize)) {
      partySize = body.partySize;
    } else {
      details.push(invalid('partySize', EXPECTED.positiveInt));
    }
  }

  let requirements = [];

  if (hasRequirements) {
    if (!Array.isArray(body.requirements)) {
      details.push(invalid('requirements', EXPECTED.array));
    } else {
      const normalized = [];
      let structureError = false;

      for (const entry of body.requirements) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          details.push(invalid('requirements', EXPECTED.object));
          structureError = true;
          continue;
        }

        const description = entry.description;
        let descriptionValid = true;

        if (typeof description !== 'string' || description.trim() === '') {
          details.push(invalid('requirements', EXPECTED.text));
          descriptionValid = false;
        } else if (description.trim().length > 500) {
          details.push(tooLong('requirements', 500));
          descriptionValid = false;
        }

        const allergyValid = typeof entry.allergies === 'boolean';

        if (!allergyValid) {
          details.push(invalid('requirements', 'a boolean'));
        }

        if (descriptionValid && allergyValid) {
          normalized.push({
            description: description.trim(),
            allergies: entry.allergies,
          });
        }
      }

      if (!structureError) {
        requirements = normalized;
      }
    }
  }

  if (!hasSlotId && !hasPartySize && !hasRequirements) {
    details.push({
      field: 'body',
      rule: 'required',
      message: 'Provide at least one of slotId, partySize or requirements.',
    });
  }

  if (details.length > 0) {
    throw invalidFields(details);
  }

  return { slotId, partySize, requirements, hasRequirements };
}

function toBookingResponse(booking, assignments, requirements = []) {
  const split = assignments.length > 1;
  const normalizedRequirements = normalizeRequirements(requirements);

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
    requirements: normalizedRequirements,
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
 * Shared email logic for booking creation and update.
 * Email delivery failures must never break the booking request.
 */
async function sendConfirmationEmail(
  notifier,
  booking,
  assignments,
  requirements,
  recipient,
  fallbackName = null
) {
  if (!notifier) return { status: 'skipped' };

  const sender =
    typeof notifier === 'function'
      ? notifier
      : notifier.sendBookingConfirmation ||
        notifier.sendConfirmation ||
        notifier.send ||
        notifier.sendEmail ||
        null;

  if (typeof sender !== 'function') {
    return { status: 'skipped' };
  }

  const fields = {
    name: booking.contact_name ?? fallbackName ?? null,
    date: booking.slot_date,
    start_time: booking.slot_start_time,
    end_time: booking.slot_end_time,
    meal: booking.meal,
    guests: booking.party_size,
    split: assignments.length > 1,
    booking_id: booking.id,
    party_requirements: requirements,
    requirements,
  };

  try {
    const delivery = await sender.call(notifier, recipient, fields);

    return {
      status: delivery?.skipped ? 'skipped' : 'sent',
    };
  } catch (err) {
    console.error('Failed to send booking confirmation email:', err);
    return { status: 'failed' };
  }
}

export function createBookingService({
  db,
  bookingDao,
  slotDao,
  timeZone,
  now = () => new Date(),
  emailService = null,
  mailer = null,
  email = null,
  mailService = null,
}) {
  const notifier = emailService || mailer || email || mailService || null;

  return {
    /**
     * Read-only preflight check.
     * createBooking repeats the check transactionally to prevent race conditions.
     */
    async checkSlotBooking(user, rawSlotId) {
      if (!user?.id) {
        throw new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED');
      }

      const slotId = parsePositiveInt(rawSlotId);

      if (slotId === null) {
        throw invalidFields([invalid('slotId', EXPECTED.positiveInt)]);
      }

      const existing = await bookingDao.findConfirmedByHikerAndSlot(
        user.id,
        slotId
      );

      return { alreadyBooked: Boolean(existing) };
    },

    /**
     * A hiker books for themself (hiker_id).
     * Staff book on someone's behalf (created_by).
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

          // Issue #25: hikers can have only one confirmed booking per slot.
          // Staff may book for multiple parties.
          if (!staff) {
            const existing = await bookingDao.findConfirmedByHikerAndSlot(
              tx,
              user.id,
              slot.id
            );

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

          const inserter = findInserter(bookingDao);

          if (data.requirements.length && inserter) {
            await inserter(tx, bookingId, data.requirements);
          }

          const booking = await bookingDao.findById(tx, bookingId);

          return {
            booking,
            assignments: seating.assignments,
          };
        });
      } catch (err) {
        if (err instanceof AppError) throw err;

        throw new AppError(
          500,
          'Internal Server Error',
          'An unexpected error occurred.',
          'INTERNAL_ERROR'
        );
      }

      const getter = findGetter(bookingDao);
      let savedRequirements = normalizeRequirements(data.requirements);

      if (getter) {
        try {
          savedRequirements = normalizeRequirements(
            await getter(result.booking.id)
          );
        } catch {
          // Keep the validated request data as fallback.
        }
      }

      // Never send a staff member's own email as the guest's confirmation.
      const recipient =
        result.booking.email ?? (staff ? null : user.email ?? null);

      const confirmationEmail = await sendConfirmationEmail(
        notifier,
        result.booking,
        result.assignments,
        savedRequirements,
        recipient,
        user.displayName ?? null
      );

      return {
        ...toBookingResponse(
          result.booking,
          result.assignments,
          savedRequirements
        ),
        confirmationEmail,
      };
    },

    /**
     * MH-06: bookings owned by the current hiker, newest slot first.
     */
    async listBookings(user) {
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED');
      }

      const rows = await bookingDao.listByHiker(user.id);
      const getter = findGetter(bookingDao);
      const bookings = [];

      for (const row of rows) {
        const assignments = await bookingDao.getSeatAssignments(row.id);

        let requirements = [];

        if (getter) {
          try {
            requirements = normalizeRequirements(await getter(row.id));
          } catch {
            requirements = [];
          }
        }

        bookings.push(
          toBookingResponse(row, assignments, requirements)
        );
      }

      return { bookings };
    },

    async getBooking(bookingIdRaw, user) {
      const bookingId = parsePositiveInt(bookingIdRaw);

      if (bookingId === null) {
        throw new NotFoundError('Booking not found.', 'BOOKING_NOT_FOUND');
      }

      const booking = await bookingDao.findById(bookingId);

      if (!booking) {
        throw new NotFoundError('Booking not found.', 'BOOKING_NOT_FOUND');
      }

      // Staff read every booking; a hiker reads only their own bookings.
      const allowed = isStaff(user) || booking.hiker_id === user.id;

      if (!allowed) {
        throw new NotFoundError('Booking not found.', 'BOOKING_NOT_FOUND');
      }

      const assignments = await bookingDao.getSeatAssignments(booking.id);
      const getter = findGetter(bookingDao);
      let requirements = [];

      if (getter) {
        try {
          requirements = normalizeRequirements(await getter(booking.id));
        } catch {
          requirements = [];
        }
      }

      return toBookingResponse(booking, assignments, requirements);
    },

    /**
     * MH-06: update slot, party size and requirements of a booking owned by
     * the current hiker.
     *
     * The 48-hour rule is checked on both the original and target slot.
     * Seat reallocation and requirement changes are performed transactionally.
     */
    async updateBooking(user, bookingIdRaw, body) {
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED');
      }

      const bookingId = parsePositiveInt(bookingIdRaw);

      if (bookingId === null) {
        throw new NotFoundError('Booking not found.', 'BOOKING_NOT_FOUND');
      }

      const data = validateUpdateBody(body);
      let result;

      try {
        result = await db.transaction(async (tx) => {
          const booking = await bookingDao.findById(tx, bookingId);

          // Hide other users' booking IDs.
          if (!booking || booking.hiker_id !== user.id) {
            throw new NotFoundError('Booking not found.', 'BOOKING_NOT_FOUND');
          }

          if (booking.status !== 'confirmed') {
            throw new ConflictError(
              'Only confirmed bookings can be changed.',
              'BOOKING_NOT_CONFIRMED'
            );
          }

          const originalSlot = await slotDao.findById(tx, booking.slot_id);

          if (!originalSlot) {
            throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');
          }

          if (isTooLateToModify(originalSlot, { timeZone, now: now() })) {
            throw new ConflictError(
              'Bookings can only be changed up to 48 hours before the slot starts.',
              'TOO_LATE_TO_MODIFY'
            );
          }

          const targetSlotId = data.slotId ?? booking.slot_id;
          const slotChanged = targetSlotId !== booking.slot_id;
          let targetSlot = originalSlot;

          if (slotChanged) {
            targetSlot = await slotDao.findById(tx, targetSlotId);

            if (!targetSlot) {
              throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');
            }

            if (targetSlot.status !== 'available') {
              throw new ConflictError(
                'Slot is not available.',
                'SLOT_NOT_AVAILABLE'
              );
            }

            if (isTooLateToModify(targetSlot, { timeZone, now: now() })) {
              throw new ConflictError(
                'Bookings can only be changed up to 48 hours before the slot starts.',
                'TOO_LATE_TO_MODIFY'
              );
            }

            // Issue #25: a hiker can have only one confirmed booking per slot.
            const duplicate = await bookingDao.findConfirmedByHikerAndSlot(
              tx,
              user.id,
              targetSlot.id
            );

            if (duplicate && duplicate.id !== booking.id) {
              throw new ConflictError(
                'You already have a confirmed booking for this slot.',
                'BOOKING_ALREADY_EXISTS'
              );
            }
          }

          const targetPartySize = data.partySize ?? booking.party_size;
          const reallocate =
            slotChanged || targetPartySize !== booking.party_size;

          if (reallocate) {
            // Release the old seats before calculating the new allocation.
            await bookingDao.deleteSeats(tx, booking.id);

            const tables = await slotDao.getTablesWithFreeForSlot(
              tx,
              targetSlot.id
            );

            const seating = seatOrFail(targetPartySize, tables);

            await bookingDao.update(tx, booking.id, {
              slotId: targetSlot.id,
              partySize: targetPartySize,
            });

            await bookingDao.insertSeats(
              tx,
              booking.id,
              seating.assignments
            );
          }

          if (data.hasRequirements) {
            const inserter = findInserter(bookingDao);

            if (typeof bookingDao.deleteRequirements !== 'function') {
              throw new AppError(
                500,
                'Internal Server Error',
                'Booking requirements cannot be updated.',
                'INTERNAL_ERROR'
              );
            }

            await bookingDao.deleteRequirements(tx, booking.id);

            if (data.requirements.length) {
              if (!inserter) {
                throw new AppError(
                  500,
                  'Internal Server Error',
                  'Booking requirements cannot be saved.',
                  'INTERNAL_ERROR'
                );
              }

              await inserter(tx, booking.id, data.requirements);
            }
          }

          const updated = await bookingDao.findById(tx, booking.id);
          const assignments = await bookingDao.getSeatAssignments(
            tx,
            booking.id
          );

          return {
            booking: updated,
            assignments,
          };
        });
      } catch (err) {
        if (err instanceof AppError) throw err;

        throw new AppError(
          500,
          'Internal Server Error',
          'An unexpected error occurred.',
          'INTERNAL_ERROR'
        );
      }

      const getter = findGetter(bookingDao);
      let savedRequirements = [];

      if (getter) {
        try {
          savedRequirements = normalizeRequirements(
            await getter(result.booking.id)
          );
        } catch {
          savedRequirements = [];
        }
      }

      // Use the guest email stored on the booking, falling back to the hiker.
      const recipient = result.booking.email ?? user.email ?? null;

      const confirmationEmail = await sendConfirmationEmail(
        notifier,
        result.booking,
        result.assignments,
        savedRequirements,
        recipient,
        user.displayName ?? null
      );

      return {
        ...toBookingResponse(
          result.booking,
          result.assignments,
          savedRequirements
        ),
        confirmationEmail,
      };
    },
  };
}
