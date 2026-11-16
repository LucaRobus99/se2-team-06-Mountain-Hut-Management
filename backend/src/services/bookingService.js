
import { AppError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../errors/AppError.js';
import { createBookingCore, runInTransaction, toBookingResponse } from './bookingCore.js';
import { createBookingNotifier } from './bookingNotifier.js';
import { HIKER_BOOKING_MESSAGE, isStaff, STAFF_ONLY_MESSAGE } from '../auth/roles.js';
import { generateTemporaryPassword, hashPassword } from './password.js';
import { validateStaffBookingBody } from './staffBookingValidation.js';
import {
  EXPECTED,
  invalid,
  invalidFields,
  isMissing,
  isPositiveInt,
  parsePositiveInt,
  required,
  tooLong,
  unknown,
} from '../utils/validation.js';
import { parseRequirements } from './requirements.js';

const CONTACT_FIELDS = ['contactName', 'email', 'contactNumber'];
const INSERT_REQUIREMENT_METHODS = [
  'insertRequirements', 'insertPartyRequirements', 'insertBookingRequirements',
  'createRequirements', 'createPartyRequirements', 'createBookingRequirements',
  'addRequirements', 'addPartyRequirements', 'saveRequirements', 'savePartyRequirements',
  'storeRequirements',
];
const GET_REQUIREMENT_METHODS = [
  'getRequirements', 'getPartyRequirements', 'getBookingRequirements',
  'findRequirements', 'findRequirementsByBookingId', 'findPartyRequirements',
  'findBookingRequirements', 'listRequirements', 'loadRequirements',
  'getRequirementsByBookingId', 'fetchRequirements',
];

function findMethod(dao, names, predicate) {
  for (const name of names) {
    if (typeof dao?.[name] === 'function') return dao[name].bind(dao);
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
  return findMethod(dao, INSERT_REQUIREMENT_METHODS, (key) => /insert|create|add|save|store/i.test(key));
}

function findGetter(dao) {
  return findMethod(dao, GET_REQUIREMENT_METHODS, (key) => /get|find|list|load|fetch/i.test(key));
}

function normalizeRequirements(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    description: r?.description ?? r?.text ?? '',
    allergies: r?.allergies === true || r?.allergies === 1 || r?.allergies === 'true' || r?.allergies === '1',
  }));
}

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
 * MH-01: only slotId and partySize are required (issue #6); requirements are
 * optional (MH-05). Contact details always come from the hiker's profile.
 * Staff book through createStaffBooking (MH-07), never through this payload.
 */
function validateBookingBody(body, user) {
  const details = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidFields([invalid('body', EXPECTED.object)]);
  }

  for (const key of Object.keys(body)) {
    if (['slotId', 'partySize', 'requirements'].includes(key)) continue;

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

  const requirements = parseRequirements(body.requirements, details) ?? [];

  if (details.length > 0) {
    throw invalidFields(details);
  }

  return {
    slotId,
    partySize,
    contact: {
      contactName: user.displayName ?? null,
      email: user.email ?? null,
      phone: user.phone ?? null,
    },
    requirements,
  };
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

  /**
   * MH-07: who a staff booking is for. Returns the account to link (if any),
   * the contact details stored on the booking and, for a new account, its
   * public summary. Runs inside the booking transaction.
   */
  async function resolveOwner(tx, data, passwordHash) {
    if (data.mode === 'existingHiker') {
      const hiker = await userDao.findById(tx, data.hikerId);

      if (!hiker || hiker.role !== 'hiker') {
        throw new NotFoundError('Hiker not found.', 'HIKER_NOT_FOUND');
      }

      return {
        hikerId: hiker.id,
        contact: { contactName: hiker.name, email: hiker.email, phone: hiker.phone },
        account: null,
      };
    }

    if (data.mode === 'newHiker') {
      const emailTaken = () =>
        new ConflictError('An account with this email already exists.', 'EMAIL_ALREADY_REGISTERED');

      if (await userDao.findByEmail(tx, data.account.email)) throw emailTaken();

      let created;

      try {
        // #36: the password is always generated by the server.
        created = await userDao.createHiker(tx, {
          ...data.account,
          passwordHash,
          passwordChangeRequired: 1,
        });
      } catch (err) {
        if (/UNIQUE constraint failed.*(users\.email|idx_users_email_ci|index.*email)/i.test(err.message)) {
          throw emailTaken();
        }
        throw err;
      }

      return {
        hikerId: created.id,
        contact: { contactName: created.name, email: created.email, phone: created.phone },
        account: {
          id: created.id,
          name: created.name,
          email: created.email,
          passwordChangeRequired: true,
        },
      };
    }

    // guest: no account, only the contact details on the booking.
    return { hikerId: null, contact: data.contact, account: null };
  }

  return {
    /** A read-only preflight check; createBooking repeats it transactionally. */
    async checkSlotBooking(user, rawSlotId) {
      if (!user?.id) throw new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED');
      const slotId = parsePositiveInt(rawSlotId);
      if (slotId === null) throw invalidFields([invalid('slotId', EXPECTED.positiveInt)]);
      const existing = await bookingDao.findConfirmedByHikerAndSlot(user.id, slotId);
      return { alreadyBooked: Boolean(existing) };
    },

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
     * MH-01 / MH-05: a hiker books for themself (hiker_id). Staff use
     * createStaffBooking (MH-07); this method refuses them as well as the route.
     */
    async createBooking(user, body) {
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED');
      }

      if (isStaff(user)) {
        throw new ForbiddenError(HIKER_BOOKING_MESSAGE, 'FORBIDDEN');
      }

      const data = validateBookingBody(body, user);

      const view = await runInTransaction(db, async (tx) => {
        const slot = await core.loadOpenSlot(tx, data.slotId);

        // Issue #25: one confirmed booking per hiker and slot.
        await core.assertNoDuplicate(tx, user.id, slot.id);

        const { bookingId, assignments } = await core.placeBooking(tx, {
          slot,
          hikerId: user.id,
          partySize: data.partySize,
          contact: data.contact,
          requirements: data.requirements,
        });

        return (await core.loadBookingView(tx, bookingId, { assignments })).view;
      });

      const confirmationEmail = await notifier.notify('created', view, view.email ?? user.email ?? null, {
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
     * The three modes only differ in who the booking is for (resolveOwner);
     * slot, duplicate and seating rules are the shared MH-01 steps:
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
      const initialPassword = data.mode === 'newHiker' ? generateTemporaryPassword() : null;
      const passwordHash = initialPassword ? hashPassword(initialPassword) : null;

      const { view, account } = await runInTransaction(db, async (tx) => {
        // #35: staff may book until the slot starts, never afterwards.
        const slot = await core.loadOpenSlot(tx, data.slotId, { leadMs: 0 });
        const owner = await resolveOwner(tx, data, passwordHash);

        // Issue #25 also applies to staff-created bookings for a hiker.
        if (owner.hikerId) {
          await core.assertNoDuplicate(tx, owner.hikerId, slot.id, {
            message: 'This hiker already has a confirmed booking for this slot.',
          });
        }

        const { bookingId, assignments } = await core.placeBooking(tx, {
          slot,
          hikerId: owner.hikerId,
          createdBy: user.id,
          partySize: data.partySize,
          contact: owner.contact,
          requirements: data.requirements,
        });

        const loaded = await core.loadBookingView(tx, bookingId, { assignments });
        return { view: loaded.view, account: owner.account };
      });

      // Only the guest's own email, never the staff member's.
      const confirmationEmail = await notifier.notify('created', view, view.email ?? null, {
        fallbackName: user.displayName ?? null,
      });

      const response = { ...view, mode: data.mode, confirmationEmail };

      if (account) {
        response.account = account;
        // #46 (option A): communicated once, only to the staff member who
        // created the account. Never emailed and never returned again.
        response.initialPassword = initialPassword;
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

    /**
     * MH-08: a hiker cancels their own booking at any time (no 48-hour rule).
     * Repeating the request is safe: the status transition happens once, so the
     * seats are released exactly once and no second email is sent. Seat rows are
     * kept for history and availability queries only count confirmed bookings.
     */
    async cancelBooking(user, bookingIdRaw) {
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED');
      }

      const bookingId = parsePositiveInt(bookingIdRaw);

      if (bookingId === null) {
        throw new NotFoundError('Booking not found.', 'BOOKING_NOT_FOUND');
      }

      const { view, cancelled } = await runInTransaction(db, async (tx) => {
        // Another hiker's booking or an unknown id: 404, never 403, so booking
        // ids cannot be enumerated. Cancelled bookings still belong to the hiker.
        const booking = await core.loadOwnedBooking(tx, bookingId, user);

        if (booking.status !== 'confirmed') {
          return { view: (await core.loadBookingView(tx, booking.id)).view, cancelled: false };
        }

        const changed = await core.cancel(tx, booking);
        return { view: (await core.loadBookingView(tx, booking.id)).view, cancelled: changed };
      });

      // Same recipient rule as MH-06: the email stored on the booking first.
      const recipient = view.email ?? user.email ?? null;
      const cancellationEmail = cancelled
        ? await notifier.notify('cancelled', view, recipient, {
            fallbackName: user.displayName ?? null,
          })
        : { status: 'skipped' };

      return { ...view, alreadyCancelled: !cancelled, cancellationEmail };
    },
  };
}
