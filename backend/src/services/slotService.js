import { AppError, NotFoundError, ConflictError, ForbiddenError } from '../errors/AppError.js';
import { isStaff, STAFF_ONLY_MESSAGE } from '../auth/roles.js';
import {
  EXPECTED,
  invalid,
  invalidFields,
  isMissing,
  isPositiveInt,
  isValidDate,
  isValidTime,
  parsePositiveInt,
  required,
  tooLong,
  unknown,
} from '../utils/validation.js';
import { canSeat } from './seating.js';
import { assertSlotOpen, seatOrFail } from './bookingRules.js';
import { isInPast, isSlotTooLate, todayInZone } from '../utils/hutTime.js';

const ALLOWED_MEALS = ['breakfast', 'lunch', 'aperitivo', 'dinner'];
const MAX_TABLE_LABEL_LENGTH = 50;

// Query parameters other than the ones read below are ignored on every GET.

function validateSlotsQuery(query) {
  const details = [];
  const q = query || {};
  const date = q.date;
  if (isMissing(date)) {
    details.push(required('date'));
  } else if (!isValidDate(date)) {
    details.push(invalid('date', EXPECTED.date));
  }
  const meal = q.meal;
  if (isMissing(meal)) {
    details.push(required('meal'));
  } else if (!ALLOWED_MEALS.includes(meal)) {
    details.push(invalid('meal', `one of ${ALLOWED_MEALS.join(', ')}`));
  }
  const partySize = parsePositiveInt(q.partySize);
  if (isMissing(q.partySize)) {
    details.push(required('partySize'));
  } else if (partySize === null) {
    details.push(invalid('partySize', EXPECTED.positiveInt));
  }
  if (details.length > 0) {
    throw invalidFields(details);
  }
  return { date, meal, partySize };
}

function validateSeatingQuery(query) {
  const details = [];
  const q = query || {};
  let partySize = null;
  if (isMissing(q.partySize)) {
    details.push(required('partySize'));
  } else {
    partySize = parsePositiveInt(q.partySize);
    if (partySize === null) {
      details.push(invalid('partySize', EXPECTED.positiveInt));
    }
  }
  if (details.length > 0) {
    throw invalidFields(details);
  }
  return { partySize };
}

function publicTables(tables) {
  return tables.map((t) => ({
    tableId: t.id,
    tableLabel: t.label,
    seats: Number(t.seats),
    freeSeats: Number(t.free),
  }));
}

function freeSeats(tables) {
  return tables.reduce((sum, t) => sum + Math.max(0, Number(t.free)), 0);
}

function toMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Checks [startTime, endTime) against the other slots of the same day.
 * Returns null when it fits, otherwise a validation detail naming the first
 * overlapping slot and a suggested time just before the overlap:
 * - the slot starts before the other one → end it when the other one starts;
 * - the slot starts inside the other one → start it when that one (and any slot
 *   right after it) ends, but only while that is still inside the meal range,
 *   so a suggestion can always be used as it is.
 * Back-to-back slots (12:00-13:00, 13:00-14:00) do not overlap. 'HH:MM' strings
 * compare correctly as text.
 */
function findOverlap(daySlots, startTime, endTime, meal) {
  const sorted = [...daySlots].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const first = sorted.find((s) => s.start_time < endTime && startTime < s.end_time);
  if (!first) return null;

  const base = `The slot overlaps slot ${first.id} (${first.start_time}-${first.end_time}).`;
  if (startTime < first.start_time) {
    return {
      field: 'endTime',
      rule: 'overlap',
      message: `${base} End it at ${first.start_time} or earlier.`,
      overlapsSlotId: first.id,
      suggestedEndTime: first.start_time,
    };
  }

  let freeStart = first.end_time;
  for (const s of sorted) {
    if (s.start_time <= freeStart && freeStart < s.end_time) freeStart = s.end_time;
  }
  if (freeStart >= meal.end_time) {
    return {
      field: 'startTime',
      rule: 'overlap',
      message: `${base} No free time is left in ${meal.meal_type} (until ${meal.end_time}).`,
      overlapsSlotId: first.id,
    };
  }
  return {
    field: 'startTime',
    rule: 'overlap',
    message: `${base} Start it at ${freeStart} or later.`,
    overlapsSlotId: first.id,
    suggestedStartTime: freeStart,
  };
}

function toSlotResponse(slot, tables) {
  return {
    id: slot.id,
    date: slot.date,
    startTime: slot.start_time,
    endTime: slot.end_time,
    durationMinutes: toMinutes(slot.end_time) - toMinutes(slot.start_time),
    status: slot.status,
    meal: slot.meal,
    tables: tables.map((t) => ({
      tableId: t.id,
      tableIdentifier: t.label,
      tableLabel: t.label,
      seats: Number(t.seats),
      freeSeats: Number(t.free),
    })),
  };
}

function validateCreateSlotBody(body) {
  const details = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    details.push(invalid('body', EXPECTED.object));
    return { details, value: null };
  }

  const allowed = ['date', 'startTime', 'endTime', 'tables', 'copyTablesFromSlotId'];
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      details.push(unknown(key));
    }
  }

  const date = body.date;
  if (isMissing(date)) {
    details.push(required('date'));
  } else if (!isValidDate(date)) {
    details.push(invalid('date', EXPECTED.date));
  }

  const startTime = body.startTime;
  if (isMissing(startTime)) {
    details.push(required('startTime'));
  } else if (!isValidTime(startTime)) {
    details.push(invalid('startTime', EXPECTED.time));
  }

  // A slot always has an end time on the same day, after its start.
  const endTime = body.endTime;
  if (isMissing(endTime)) {
    details.push(required('endTime'));
  } else if (!isValidTime(endTime)) {
    details.push(invalid('endTime', EXPECTED.time));
  } else if (isValidTime(startTime) && endTime <= startTime) {
    details.push(invalid('endTime', 'after startTime on the same day'));
  }

  let tables = body.tables;
  if (!isMissing(tables)) {
    if (!Array.isArray(tables)) {
      details.push(invalid('tables', EXPECTED.array));
      tables = null;
    } else {
      const validated = [];
      tables.forEach((t, idx) => {
        if (!t || typeof t !== 'object' || Array.isArray(t)) {
          details.push(invalid(`tables[${idx}]`, EXPECTED.object));
          return;
        }
        const tAllowed = ['tableIdentifier', 'tableLabel', 'seats'];
        for (const key of Object.keys(t)) {
          if (!tAllowed.includes(key)) {
            details.push(unknown(`tables[${idx}].${key}`));
          }
        }
        // tableLabel is accepted as another name for tableIdentifier; send one of them.
        // Errors name the field the client actually sent (tableIdentifier when neither is).
        const name = isMissing(t.tableIdentifier) && !isMissing(t.tableLabel) ? 'tableLabel' : 'tableIdentifier';
        const field = `tables[${idx}].${name}`;
        const identifier = t[name];
        let label = null;
        if (!isMissing(t.tableIdentifier) && !isMissing(t.tableLabel)) {
          details.push({ field, rule: 'conflict', message: 'Send either tableIdentifier or tableLabel, not both.' });
        } else if (isMissing(identifier) || (typeof identifier === 'string' && identifier.trim() === '')) {
          details.push(required(field));
        } else if (typeof identifier !== 'string') {
          details.push(invalid(field, EXPECTED.string));
        } else {
          label = identifier.trim();
        }
        const seats = isPositiveInt(t.seats) ? t.seats : null;
        if (seats === null) {
          details.push(invalid(`tables[${idx}].seats`, EXPECTED.positiveInt));
        }
        if (label !== null && seats !== null) {
          if (label.length > MAX_TABLE_LABEL_LENGTH) {
            details.push(tooLong(field, MAX_TABLE_LABEL_LENGTH));
          }
          if (validated.some((v) => v.tableIdentifier === label)) {
            details.push({ field, rule: 'duplicate', message: `${label} is listed more than once.` });
          }
          validated.push({ tableIdentifier: label, seats });
        }
      });
      tables = validated;
    }
  }

  let copyTablesFromSlotId = null;
  if (!isMissing(body.copyTablesFromSlotId)) {
    if (isPositiveInt(body.copyTablesFromSlotId)) {
      copyTablesFromSlotId = body.copyTablesFromSlotId;
    } else {
      details.push(invalid('copyTablesFromSlotId', EXPECTED.positiveInt));
    }
  }

  // A slot gets its table set either from the request or as a copy, never both.
  if (copyTablesFromSlotId !== null && Array.isArray(tables) && tables.length > 0) {
    details.push({ field: 'tables', rule: 'conflict', message: 'Send either tables or copyTablesFromSlotId, not both.' });
  }

  if (details.length > 0) {
    return { details, value: null };
  }

  return {
    details: [],
    value: {
      date,
      startTime,
      endTime,
      tables: tables ?? [],
      copyTablesFromSlotId,
    },
  };
}

/** Staff slot list filters: `date` (the caller defaults it to today) and `meal`, both optional. */
function validateListSlotsQuery(query) {
  const details = [];
  const q = query || {};
  const date = isMissing(q.date) ? null : q.date;
  if (date !== null && !isValidDate(date)) {
    details.push(invalid('date', EXPECTED.date));
  }
  const meal = isMissing(q.meal) ? null : q.meal;
  if (meal !== null && !ALLOWED_MEALS.includes(meal)) {
    details.push(invalid('meal', `one of ${ALLOWED_MEALS.join(', ')}`));
  }
  if (details.length > 0) {
    throw invalidFields(details);
  }
  return { date, meal };
}

export function createSlotService({ slotDao, db, timeZone, now = () => new Date() }) {
  async function loadSlot(slotIdRaw) {
    const slotId = parsePositiveInt(slotIdRaw);
    if (slotId === null) throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');
    const slot = await slotDao.findById(slotId);
    if (!slot) {
      throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');
    }
    return slot;
  }

  /** Tables (with free seats) of several slots in one query, as Map(slotId → rows). */
  async function tablesGroupedBySlot(slots) {
    const rows = await slotDao.getTablesWithFreeForSlots(slots.map((s) => s.id));
    const bySlot = new Map(slots.map((s) => [s.id, []]));
    for (const row of rows) bySlot.get(row.slot_id).push(row);
    return bySlot;
  }

  /** Slot management is staff only (MH-02). */
  function assertStaff(user) {
    if (!isStaff(user)) {
      throw new ForbiddenError(STAFF_ONLY_MESSAGE, 'FORBIDDEN');
    }
  }

  return {
    async createSlot(user, body) {
      assertStaff(user);
      const { details, value } = validateCreateSlotBody(body);
      if (details.length > 0) {
        throw invalidFields(details);
      }

      // Slots cannot be created in the past (hut local time).
      if (isInPast(value.date, value.startTime, { timeZone, now: now() })) {
        const field = value.date < todayInZone(timeZone, now()) ? 'date' : 'startTime';
        throw invalidFields([
          { field, rule: 'past', message: 'Slots cannot be created in the past.' },
        ]);
      }

      let slotId;
      const doCreate = async (exec) => {
        // The whole slot must fall inside the meal its start time belongs to.
        const meal = await slotDao.findMealAt(exec, value.startTime);
        if (!meal) {
          throw invalidFields([
            { field: 'startTime', rule: 'no_meal', message: 'No meal is served at this slot start time.' },
          ]);
        }
        if (value.endTime > meal.end_time) {
          throw invalidFields([
            {
              field: 'endTime',
              rule: 'outside_meal',
              message: `The slot must end by ${meal.end_time}, when ${meal.meal_type} ends.`,
              suggestedEndTime: meal.end_time,
            },
          ]);
        }

        // Checked inside the transaction so two concurrent creations cannot both fit.
        const daySlots = await slotDao.listByDate(exec, value.date);
        const overlap = findOverlap(daySlots, value.startTime, value.endTime, meal);
        if (overlap) {
          throw new ConflictError('The slot overlaps another slot.', 'SLOT_OVERLAP', [overlap]);
        }

        // Reusing a table set copies its tables and seats into the new slot;
        // later changes to either slot do not affect the other (issue #17).
        let tableSet = null;
        if (value.copyTablesFromSlotId) {
          const sourceSlot = await slotDao.findById(exec, value.copyTablesFromSlotId);
          if (!sourceSlot) {
            throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');
          }
          tableSet = await slotDao.getTableSetForSlot(exec, sourceSlot.id);
        }

        const id = await slotDao.createSlot(exec, {
          date: value.date,
          startTime: value.startTime,
          endTime: value.endTime,
          status: 'available',
        });

        if (tableSet) {
          for (const t of tableSet) {
            await slotDao.addTableToSlot(exec, id, t.tableId, t.seats);
          }
        } else {
          // A label is a table of the hut (created on first use); its seats belong to this slot only.
          for (const t of value.tables) {
            const table = await slotDao.findTableByLabel(exec, t.tableIdentifier);
            const tableId = table ? table.id : await slotDao.createTable(exec, { label: t.tableIdentifier });
            await slotDao.addTableToSlot(exec, id, tableId, t.seats);
          }
        }

        return id;
      };

      try {
        if (db && typeof db.transaction === 'function') {
          slotId = await db.transaction(async (tx) => doCreate(tx));
        } else {
          slotId = await doCreate();
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
        // Safety nets: the DB triggers caught something the checks above missed.
        if (err?.message?.includes('meal time range')) {
          throw invalidFields([invalid('endTime', 'within the meal time range of the start time')]);
        }
        if (err?.message?.includes('overlaps another slot')) {
          throw new ConflictError('The slot overlaps another slot.', 'SLOT_OVERLAP', [
            { field: 'startTime', rule: 'overlap', message: 'The slot overlaps another slot on this date.' },
          ]);
        }
        throw err;
      }

      return this.getSlot(user, slotId);
    },

    async getSlot(user, slotIdRaw) {
      assertStaff(user);
      const slot = await loadSlot(slotIdRaw);

      const tables = await slotDao.getTablesWithFreeForSlot(slot.id);
      return toSlotResponse(slot, tables);
    },

    async listSlots(user, query) {
      assertStaff(user);
      const filters = validateListSlotsQuery(query);
      const date = filters.date ?? todayInZone(timeZone, now());
      const { meal } = filters;
      const slots = (await slotDao.listByDate(date)).filter((s) => !meal || s.meal === meal);
      const tablesBySlot = await tablesGroupedBySlot(slots);
      const result = slots.map((slot) => toSlotResponse(slot, tablesBySlot.get(slot.id)));
      return { date, meal, slots: result };
    },

    async listAvailableSlots(query) {
      const { date, meal, partySize } = validateSlotsQuery(query);
      const currentTime = now();
      const slots = (await slotDao.listByDate(date)).filter(
        (slot) =>
          slot.status === 'available' &&
          slot.meal === meal &&
          !isSlotTooLate(slot, { timeZone, now: currentTime })
      );
      const tablesBySlot = await tablesGroupedBySlot(slots);
      const result = [];

      for (const slot of slots) {
        const tables = tablesBySlot.get(slot.id);
        if (!canSeat(partySize, tables)) continue;

        result.push({
          id: slot.id,
          startTime: slot.start_time,
          endTime: slot.end_time,
          availableSeats: freeSeats(tables),
          tables: publicTables(tables),
        });
      }

      result.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id - b.id);
      return { date, meal, partySize, slots: result };
    },

    async getSeating(slotIdRaw, query) {
      const { partySize } = validateSeatingQuery(query);
      const slot = await loadSlot(slotIdRaw);

      assertSlotOpen(slot, { timeZone, now: now() });

      const tables = await slotDao.getTablesWithFreeForSlot(slot.id);
      const seating = seatOrFail(partySize, tables);

      const requiresConfirmation = seating.fit === 'split';
      const response = {
        slotId: slot.id,
        startTime: slot.start_time,
        endTime: slot.end_time,
        partySize,
        fit: seating.fit,
        requiresConfirmation,
        seatAssignments: seating.assignments,
        availableSeats: freeSeats(tables),
        tables: publicTables(tables),
      };
      if (requiresConfirmation) {
        response.confirmation = {
          code: 'GROUP_SPLIT',
          message:
            'There is no single table for the whole group. The party will be split across tables.',
        };
      }
      return response;
    },
  };
}
