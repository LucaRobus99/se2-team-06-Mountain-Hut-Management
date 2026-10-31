import { NotFoundError, ConflictError, UnprocessableEntityError, ValidationError, ForbiddenError } from '../errors/AppError.js';
import { canSeat, computeSeating } from './seating.js';
import { isSlotTooLate } from '../utils/hutTime.js';

const ALLOWED_MEALS = ['breakfast', 'lunch', 'aperitivo', 'dinner'];

function validateDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validatePartySize(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return n > 0 ? n : null;
  }
  return null;
}

function parsePositiveInt(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return n > 0 ? n : null;
  }
  return null;
}

function validateSlotsQuery(query) {
  const details = [];
  const q = query || {};
  const allowed = ['date', 'meal', 'partySize'];
  for (const key of Object.keys(q)) {
    if (!allowed.includes(key)) {
      details.push({ field: key, rule: 'unknown', message: `${key} is not allowed.` });
    }
  }
  const date = q.date;
  if (date === undefined || date === null || date === '') {
    details.push({ field: 'date', rule: 'required', message: 'date is required.' });
  } else if (!validateDate(date)) {
    details.push({ field: 'date', rule: 'invalid', message: 'date is invalid.' });
  }
  const meal = q.meal;
  if (meal === undefined || meal === null || meal === '') {
    details.push({ field: 'meal', rule: 'required', message: 'meal is required.' });
  } else if (!ALLOWED_MEALS.includes(meal)) {
    details.push({ field: 'meal', rule: 'invalid', message: 'meal is invalid.' });
  }
  const partySize = validatePartySize(q.partySize);
  if (q.partySize === undefined || q.partySize === null || q.partySize === '') {
    details.push({ field: 'partySize', rule: 'required', message: 'partySize is required.' });
  } else if (partySize === null) {
    details.push({ field: 'partySize', rule: 'invalid', message: 'partySize is invalid.' });
  }
  if (details.length > 0) {
    throw new ValidationError('The request contains invalid fields.', 'VALIDATION_ERROR', details);
  }
  return { date, meal, partySize };
}

function validateSeatingQuery(query) {
  const details = [];
  const q = query || {};
  const allowed = ['partySize'];
  for (const key of Object.keys(q)) {
    if (!allowed.includes(key)) {
      details.push({ field: key, rule: 'unknown', message: `${key} is not allowed.` });
    }
  }
  let partySize = null;
  if (q.partySize === undefined || q.partySize === null || q.partySize === '') {
    details.push({ field: 'partySize', rule: 'required', message: 'partySize is required.' });
  } else {
    partySize = validatePartySize(q.partySize);
    if (partySize === null) {
      details.push({ field: 'partySize', rule: 'invalid', message: 'partySize is invalid.' });
    }
  }
  if (details.length > 0) {
    throw new ValidationError('The request contains invalid fields.', 'VALIDATION_ERROR', details);
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

function validateTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function validateCreateSlotBody(body) {
  const details = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    details.push({ field: 'body', rule: 'invalid', message: 'Request body must be an object.' });
    return { details, value: null };
  }

  const allowed = ['date', 'startTime', 'durationMinutes', 'tables', 'copyTablesFromSlotId', 'hutId', 'status'];
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      details.push({ field: key, rule: 'unknown', message: `${key} is not allowed.` });
    }
  }

  const date = body.date;
  if (date === undefined || date === null || date === '') {
    details.push({ field: 'date', rule: 'required', message: 'date is required.' });
  } else if (!validateDate(date)) {
    details.push({ field: 'date', rule: 'invalid', message: 'date is invalid.' });
  }

  const startTime = body.startTime;
  if (startTime === undefined || startTime === null || startTime === '') {
    details.push({ field: 'startTime', rule: 'required', message: 'startTime is required.' });
  } else if (!validateTime(startTime)) {
    details.push({ field: 'startTime', rule: 'invalid', message: 'startTime is invalid.' });
  }

  let durationMinutes = body.durationMinutes;
  if (durationMinutes === undefined || durationMinutes === null || durationMinutes === '') {
    details.push({ field: 'durationMinutes', rule: 'required', message: 'durationMinutes is required.' });
  } else {
    const n = parsePositiveInt(durationMinutes);
    if (n === null) {
      details.push({ field: 'durationMinutes', rule: 'invalid', message: 'durationMinutes is invalid.' });
    } else {
      durationMinutes = n;
    }
  }

  let tables = body.tables;
  if (tables !== undefined && tables !== null) {
    if (!Array.isArray(tables)) {
      details.push({ field: 'tables', rule: 'invalid', message: 'tables must be an array.' });
      tables = null;
    } else {
      const validated = [];
      tables.forEach((t, idx) => {
        if (!t || typeof t !== 'object' || Array.isArray(t)) {
          details.push({ field: `tables[${idx}]`, rule: 'invalid', message: 'table must be an object.' });
          return;
        }
        const tAllowed = ['tableIdentifier', 'tableLabel', 'seats', 'tableId'];
        for (const key of Object.keys(t)) {
          if (!tAllowed.includes(key)) {
            details.push({ field: `tables[${idx}].${key}`, rule: 'unknown', message: `${key} is not allowed.` });
          }
        }
        const identifier = t.tableIdentifier ?? t.tableLabel;
        if (identifier === undefined || identifier === null || String(identifier).trim() === '') {
          details.push({ field: `tables[${idx}].tableIdentifier`, rule: 'required', message: 'tableIdentifier is required.' });
        }
        const seats = parsePositiveInt(t.seats);
        if (seats === null) {
          details.push({ field: `tables[${idx}].seats`, rule: 'invalid', message: 'seats is invalid.' });
        }
        if (identifier !== undefined && seats !== null) {
          validated.push({ tableIdentifier: String(identifier).trim(), seats });
        }
      });
      tables = validated;
    }
  }

  let copyTablesFromSlotId = body.copyTablesFromSlotId;
  if (copyTablesFromSlotId !== undefined && copyTablesFromSlotId !== null && copyTablesFromSlotId !== '') {
    const n = parsePositiveInt(copyTablesFromSlotId);
    if (n === null) {
      details.push({ field: 'copyTablesFromSlotId', rule: 'invalid', message: 'copyTablesFromSlotId is invalid.' });
    } else {
      copyTablesFromSlotId = n;
    }
  } else {
    copyTablesFromSlotId = null;
  }

  if (details.length > 0) {
    return { details, value: null };
  }

  return {
    details: [],
    value: {
      date,
      startTime,
      durationMinutes,
      tables: tables ?? [],
      copyTablesFromSlotId,
      hutId: body.hutId,
    },
  };
}

function validateOptionalDate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!validateDate(value)) return null;
  return value;
}

export function createSlotService({ slotDao, hutDao, db, timeZone, now = () => new Date() }) {
  async function assertHut(hutIdRaw) {
    const hutId = parsePositiveInt(hutIdRaw);
    if (hutId === null) throw new NotFoundError('Hut not found.', 'HUT_NOT_FOUND');
    const hut = await hutDao.findById(hutId);
    if (!hut) throw new NotFoundError('Hut not found.', 'HUT_NOT_FOUND');
    return hut;
  }

  async function loadSlot(hutId, slotIdRaw) {
    const slotId = parsePositiveInt(slotIdRaw);
    if (slotId === null) throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');
    const slot = await slotDao.findById(slotId);
    if (!slot || slot.hut_id !== hutId) {
      throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');
    }
    return slot;
  }

  return {
    async createSlot(user, hutIdParam, body) {
      if (!user || user.role !== 'employee') {
        throw new ForbiddenError('Forbidden.', 'FORBIDDEN');
      }
      const { details, value } = validateCreateSlotBody(body);
      if (details.length > 0) {
        throw new ValidationError('The request contains invalid fields.', 'VALIDATION_ERROR', details);
      }

      const hutId = hutIdParam ? parsePositiveInt(hutIdParam) : parsePositiveInt(user.hutId);
      if (hutId === null) throw new NotFoundError('Hut not found.', 'HUT_NOT_FOUND');
      const hut = await hutDao.findById(hutId);
      if (!hut) throw new NotFoundError('Hut not found.', 'HUT_NOT_FOUND');

      // If hutId provided in body, respect it only if matches? Use body hutId if valid.
      const resolvedHutId = value.hutId ? (parsePositiveInt(value.hutId) ?? hutId) : hutId;
      const hut2 = await hutDao.findById(resolvedHutId);
      if (!hut2) throw new NotFoundError('Hut not found.', 'HUT_NOT_FOUND');

      const endTime = addMinutes(value.startTime, value.durationMinutes);

      // resolve source tables for copy
      let sourceTableIds = null;
      if (value.copyTablesFromSlotId) {
        const sourceSlot = await loadSlot(resolvedHutId, value.copyTablesFromSlotId);
        sourceTableIds = await slotDao.getTableIdsForSlot(sourceSlot.id);
      }

      let slotId;
      const doCreate = async (exec) => {
        const id = await slotDao.createSlot(exec, {
          hutId: resolvedHutId,
          date: value.date,
          startTime: value.startTime,
          endTime,
          status: 'available',
        });

        if (sourceTableIds) {
          for (const tableId of sourceTableIds) {
            await slotDao.addTableToSlot(exec, id, tableId);
          }
        } else {
          for (const t of value.tables) {
            let table = await slotDao.findTableByLabel(exec, resolvedHutId, t.tableIdentifier);
            let tableId;
            if (!table) {
              tableId = await slotDao.createTable(exec, {
                hutId: resolvedHutId,
                label: t.tableIdentifier,
                seats: t.seats,
              });
            } else {
              tableId = table.id;
              await slotDao.updateTableSeats(exec, tableId, t.seats);
            }
            await slotDao.addTableToSlot(exec, id, tableId);
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
        if (err?.message?.includes('No meal')) {
          throw new ValidationError('The request contains invalid fields.', 'VALIDATION_ERROR', [
            { field: 'startTime', rule: 'invalid', message: 'No meal is served at this slot start time.' },
          ]);
        }
        if (err?.message?.includes('UNIQUE constraint failed')) {
          throw new ConflictError('Slot already exists for this date and start time.', 'CONFLICT');
        }
        throw err;
      }

      return this.getSlot(resolvedHutId, slotId);
    },

    async getSlot(hutIdRaw, slotIdRaw) {
      const hut = await assertHut(hutIdRaw);
      const slot = await loadSlot(hut.id, slotIdRaw);

      const tables = await slotDao.getTablesWithFreeForSlot(slot.id);
      const mappedTables = tables.map((t) => ({
        tableId: t.id,
        tableIdentifier: t.label,
        tableLabel: t.label,
        seats: Number(t.seats),
        freeSeats: Number(t.free),
      }));

      const durationMinutes = slot.end_time
        ? (() => {
            const [sh, sm] = slot.start_time.split(':').map(Number);
            const [eh, em] = slot.end_time.split(':').map(Number);
            let diff = (eh * 60 + em) - (sh * 60 + sm);
            if (diff < 0) diff += 24 * 60;
            return diff;
          })()
        : null;

      return {
        id: slot.id,
        hutId: hut.id,
        date: slot.date,
        startTime: slot.start_time,
        endTime: slot.end_time ?? null,
        durationMinutes,
        status: slot.status,
        meal: slot.meal,
        tables: mappedTables,
      };
    },

    async listSlots(hutIdRaw, query) {
      const hut = await assertHut(hutIdRaw);
      const q = query || {};
      const date = validateOptionalDate(q.date);
      if (q.date && !date) {
        throw new ValidationError('The request contains invalid fields.', 'VALIDATION_ERROR', [
          { field: 'date', rule: 'invalid', message: 'date is invalid.' },
        ]);
      }
      const slots = await slotDao.listByHut(hut.id, date);
      const result = [];
      for (const slot of slots) {
        const tables = await slotDao.getTablesWithFreeForSlot(slot.id);
        const mappedTables = tables.map((t) => ({
          tableId: t.id,
          tableIdentifier: t.label,
          tableLabel: t.label,
          seats: Number(t.seats),
          freeSeats: Number(t.free),
        }));
        const durationMinutes = slot.end_time
          ? (() => {
              const [sh, sm] = slot.start_time.split(':').map(Number);
              const [eh, em] = slot.end_time.split(':').map(Number);
              let diff = (eh * 60 + em) - (sh * 60 + sm);
              if (diff < 0) diff += 24 * 60;
              return diff;
            })()
          : null;
        result.push({
          id: slot.id,
          hutId: hut.id,
          date: slot.date,
          startTime: slot.start_time,
          endTime: slot.end_time ?? null,
          durationMinutes,
          status: slot.status,
          meal: slot.meal,
          tables: mappedTables,
        });
      }
      return { hutId: hut.id, date: date ?? null, slots: result };
    },
    async listAvailableSlots(hutIdRaw, query) {
      const { date, meal, partySize } = validateSlotsQuery(query);
      const hut = await assertHut(hutIdRaw);
      const currentTime = now();
      const slots = await slotDao.listByDate(hut.id, date);
      const result = [];

      for (const slot of slots) {
        if (slot.status !== 'available') continue;
        if (slot.meal !== meal) continue;
        if (isSlotTooLate(slot, { timeZone, now: currentTime })) continue;

        const tables = await slotDao.getTablesWithFreeForSlot(slot.id);
        if (!canSeat(partySize, tables)) continue;

        result.push({
          id: slot.id,
          startTime: slot.start_time,
          availableSeats: freeSeats(tables),
          tables: publicTables(tables),
        });
      }

      result.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id - b.id);
      return { hutId: hut.id, date, meal, partySize, slots: result };
    },

    async getSeating(hutIdRaw, slotIdRaw, query) {
      const { partySize } = validateSeatingQuery(query);
      const hut = await assertHut(hutIdRaw);
      const slot = await loadSlot(hut.id, slotIdRaw);

      if (slot.status !== 'available') {
        throw new ConflictError('Slot is not available.', 'SLOT_NOT_AVAILABLE');
      }
      if (isSlotTooLate(slot, { timeZone, now: now() })) {
        throw new UnprocessableEntityError(
          'Bookings close two hours before the slot starts.',
          'SLOT_TOO_LATE'
        );
      }

      const tables = await slotDao.getTablesWithFreeForSlot(slot.id);
      const seating = computeSeating(partySize, tables);
      if (!seating) {
        throw new ConflictError('Insufficient capacity.', 'INSUFFICIENT_CAPACITY', []);
      }

      const requiresConfirmation = seating.fit === 'split';
      const response = {
        hutId: hut.id,
        slotId: slot.id,
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
