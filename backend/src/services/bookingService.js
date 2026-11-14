
import { AppError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../errors/AppError.js';
import { assertSlotOpen, seatOrFail } from './bookingRules.js';
import { createBookingCore, runInTransaction, toBookingResponse } from './bookingCore.js';
import { createBookingNotifier } from './bookingNotifier.js';
import { isStaff, STAFF_ONLY_MESSAGE } from '../auth/roles.js';
import { generateTemporaryPassword, hashPassword } from './password.js';
import { validateStaffBookingBody } from './staffBookingValidation.js';
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
import { parseRequirements } from './requirements.js';

const CONTACT_FIELDS = ['contactName', 'email', 'contactNumber'];

/** MH-07: booking endpoints that only staff may use. */
function assertStaffUser(user) {
  if (!user || !user.id) {
    throw new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED');
  }

  if (!isStaff(user)) {
    throw new ForbiddenError(STAFF_ONLY_MESSAGE, 'FORBIDDEN');
  }
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

  const requirements = parseRequirements(body.requirements, details) ?? [];

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
    } else if (isMissing(body.contactName)) {
      // MH-07: a temporary guest always needs a name; do not allow the legacy
      // staff path to create an anonymous guest with only an email or phone.
      details.push(required('contactName'));
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
  // `requirements: []` is a change (clears them); an absent field is not.
  const requirements = parseRequirements(body.requirements, details);
  const hasRequirements = requirements !== null;

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

  return { slotId, partySize, requirements: requirements ?? [], hasRequirements };
}

/**
 * MH-07 (#46, option A): the generated initial password is communicated by the
 * staff member who created the account. It is returned once in the creation
 * response and is never emailed, logged or exposed anywhere else.
 */
export function createBookingService({
  db,
  bookingDao,
  slotDao,
  userDao = null,
  timeZone,
  now = () => new Date(),
  emailService = null,
}) {
  const core = createBookingCore({ bookingDao, slotDao, timeZone, now });
  const notifier = createBookingNotifier(emailService);

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

      const existing = await bookingDao.findConfirmedByHikerAndSlot(user.id, slotId);

      return { alreadyBooked: Boolean(existing) };
    },

    /**
     * MH-01 / MH-05: a hiker books for themself (hiker_id).
     * Staff can still book on someone's behalf (created_by) through this
     * legacy path; MH-07 bookings go through createStaffBooking.
     */
    async createBooking(user, body) {
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED');
      }

      const staff = isStaff(user);
      const data = validateBookingBody(body, user);

      const view = await runInTransaction(db, async (tx) => {
        // MH-07 (#35): staff may book until the slot starts, hikers need 2h.
        const slot = await core.loadOpenSlot(tx, data.slotId, staff ? { leadMs: 0 } : {});

        // Issue #25: hikers can have only one confirmed booking per slot.
        // Staff may book for multiple parties.
        if (!staff) {
          await core.assertNoDuplicate(tx, user.id, slot.id);
        }

        const { bookingId, assignments } = await core.placeBooking(tx, {
          slot,
          hikerId: staff ? null : user.id,
          createdBy: staff ? user.id : null,
          partySize: data.partySize,
          contact: { contactName: data.contactName, email: data.email, phone: data.phone },
          requirements: data.requirements,
        });

        return (await core.loadBookingView(tx, bookingId, { assignments })).view;
      });

      // Never send a staff member's own email as the guest's confirmation.
      const recipient = view.email ?? (staff ? null : user.email ?? null);
      const confirmationEmail = await notifier.notify('created', view, recipient, {
        fallbackName: user.displayName ?? null,
      });

      return { ...view, confirmationEmail };
    },

    /**
     * MH-07: staff-only hiker search (name, email or phone). Returns only the
     * minimal fields needed to choose the right person.
     */
    async searchHikers(user, rawQuery) {
      assertStaffUser(user);

      const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';

      if (query.length < 2) {
        throw invalidFields([invalid('query', 'at least 2 characters')]);
      }

      if (query.length > 100) {
        throw invalidFields([tooLong('query', 100)]);
      }

      if (!userDao || typeof userDao.searchHikers !== 'function') {
        throw new AppError(
          500,
          'Internal Server Error',
          'Hiker search is not available.',
          'INTERNAL_ERROR'
        );
      }

      const rows = await userDao.searchHikers(query, 20);

      return {
        hikers: rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone ?? null,
        })),
      };
    },

    /**
     * MH-07 (#35/#36): staff create a booking on behalf of someone else.
     *
     * The three modes share the MH-01 seat allocation:
     * - existingHiker: the owner is an existing hiker account;
     * - guest:         no account at all, name required, phone/email optional;
     * - newHiker:      a complete account is created in the same transaction
     *                  with a server-generated password that must be changed at
     *                  first login.
     *
     * If the booking fails (e.g. not enough seats), the account creation is
     * rolled back too. The initial password is returned only here, once.
     */
    async createStaffBooking(user, body) {
      assertStaffUser(user);

      if (!userDao) {
        throw new AppError(
          500,
          'Internal Server Error',
          'Staff bookings are not available.',
          'INTERNAL_ERROR'
        );
      }

      const data = validateStaffBookingBody(body);

      // #36: generate the password and its hash before opening the SQLite
      // transaction, so the CPU-heavy scrypt work does not hold the write lock.
      let preparedPassword = null;
      let preparedPasswordHash = null;

      if (data.mode === 'newHiker') {
        preparedPassword = generateTemporaryPassword();
        preparedPasswordHash = hashPassword(preparedPassword);
      }

      let result;

      try {
        result = await db.transaction(async (tx) => {
          const slot = await slotDao.findById(tx, data.slotId);

          if (!slot) {
            throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');
          }

          // #35: staff may book until the slot starts, never afterwards.
          assertSlotOpen(slot, { timeZone, now: now(), leadMs: 0 });

          let hikerId = null;
          let contact = data.contact;
          let account = null;

          if (data.mode === 'existingHiker') {
            const hiker = await userDao.findById(tx, data.hikerId);

            if (!hiker || hiker.role !== 'hiker') {
              throw new NotFoundError('Hiker not found.', 'HIKER_NOT_FOUND');
            }

            hikerId = hiker.id;
            contact = { contactName: hiker.name, email: hiker.email, phone: hiker.phone };
          } else if (data.mode === 'newHiker') {
            const existing = await userDao.findByEmail(tx, data.account.email);

            if (existing) {
              throw new ConflictError(
                'An account with this email already exists.',
                'EMAIL_ALREADY_REGISTERED'
              );
            }

            // #36: the password is always generated by the server.
            let created;

            try {
              created = await userDao.createHiker(tx, {
                ...data.account,
                passwordHash: preparedPasswordHash,
                passwordChangeRequired: 1,
              });
            } catch (err) {
              if (/UNIQUE constraint failed.*(users\.email|idx_users_email_ci|index.*email)/i.test(err.message)) {
                throw new ConflictError(
                  'An account with this email already exists.',
                  'EMAIL_ALREADY_REGISTERED'
                );
              }
              throw err;
            }

            hikerId = created.id;
            account = {
              id: created.id,
              name: created.name,
              email: created.email,
              passwordChangeRequired: true,
            };
            contact = { contactName: created.name, email: created.email, phone: created.phone };
          }

          // Issue #25 also applies to staff-created bookings for a hiker.
          if (hikerId) {
            const duplicate = await bookingDao.findConfirmedByHikerAndSlot(
              tx,
              hikerId,
              slot.id
            );

            if (duplicate) {
              throw new ConflictError(
                'This hiker already has a confirmed booking for this slot.',
                'BOOKING_ALREADY_EXISTS'
              );
            }
          }

          const tables = await slotDao.getTablesWithFreeForSlot(tx, slot.id);
          const seating = seatOrFail(data.partySize, tables);

          const bookingId = await bookingDao.create(tx, {
            slotId: slot.id,
            hikerId,
            createdBy: user.id,
            partySize: data.partySize,
            contactName: contact?.contactName ?? null,
            email: contact?.email ?? null,
            phone: contact?.phone ?? null,
          });

          await bookingDao.insertSeats(tx, bookingId, seating.assignments);

          await bookingDao.insertRequirements(tx, bookingId, data.requirements);

          const booking = await bookingDao.findById(tx, bookingId);

          return {
            booking,
            assignments: seating.assignments,
            account,
            initialPassword: preparedPassword,
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

      const { view } = await core.loadBookingView(db, result.booking.id, {
        assignments: result.assignments,
      });

      const confirmationEmail = await notifier.notify('created', view, view.email ?? null, {
        fallbackName: user.displayName ?? null,
      });

      const response = {
        ...view,
        mode: data.mode,
        confirmationEmail,
      };

      if (result.account) {
        response.account = result.account;
        // #46 (option A): communicated once, only to the staff member who
        // created the account. Never emailed and never returned again.
        response.initialPassword = result.initialPassword;
      }

      return response;
    },


    /**
     * MH-06: bookings owned by the current hiker, newest slot first.
     */
    async listBookings(user) {
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED');
      }

      const rows = await bookingDao.listByHiker(user.id);
      const requirementsById = await bookingDao.getRequirementsByBookingIds(
        rows.map((row) => row.id)
      );
      const bookings = [];

      for (const row of rows) {
        const assignments = await bookingDao.getSeatAssignments(row.id);
        bookings.push(toBookingResponse(row, assignments, requirementsById.get(row.id) ?? []));
      }

      return { bookings };
    },

    /** Staff read every booking; a hiker reads only their own bookings. */
    async getBooking(bookingIdRaw, user) {
      const booking = await core.loadOwnedBooking(db, parsePositiveInt(bookingIdRaw), user, {
        allowStaff: true,
      });
      const assignments = await bookingDao.getSeatAssignments(booking.id);
      const requirements = await bookingDao.getRequirements(booking.id);
      return toBookingResponse(booking, assignments, requirements);
    },

    /**
     * MH-06: update slot, party size and requirements of a booking owned by
     * the current hiker.
     *
     * The 48-hour rule is checked on both the original and target slot (#43).
     * Seat reallocation and requirement changes are performed transactionally:
     * if anything fails the booking stays as it was (#38).
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

      const view = await runInTransaction(db, async (tx) => {
        const booking = await core.loadOwnedBooking(tx, bookingId, user);
        core.assertConfirmed(booking);

        const originalSlot = await core.loadSlot(tx, booking.slot_id);
        core.assertChangeAllowed(originalSlot);

        const targetSlotId = data.slotId ?? booking.slot_id;
        const slotChanged = targetSlotId !== booking.slot_id;
        let targetSlot = originalSlot;

        if (slotChanged) {
          targetSlot = await core.loadSlot(tx, targetSlotId);

          if (targetSlot.status !== 'available') {
            throw new ConflictError('Slot is not available.', 'SLOT_NOT_AVAILABLE');
          }

          core.assertChangeAllowed(targetSlot);
          await core.assertNoDuplicate(tx, user.id, targetSlot.id, { exceptBookingId: booking.id });
        }

        const targetPartySize = data.partySize ?? booking.party_size;

        if (slotChanged || targetPartySize !== booking.party_size) {
          await core.reseat(tx, booking, { slot: targetSlot, partySize: targetPartySize });
        }

        if (data.hasRequirements) {
          await bookingDao.replaceRequirements(tx, booking.id, data.requirements);
        }

        return (await core.loadBookingView(tx, booking.id)).view;
      });

      // Use the guest email stored on the booking, falling back to the hiker.
      const recipient = view.email ?? user.email ?? null;
      const confirmationEmail = await notifier.notify('updated', view, recipient, {
        fallbackName: user.displayName ?? null,
      });

      return { ...view, confirmationEmail };
    },
  };
}
