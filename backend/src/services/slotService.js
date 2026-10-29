import { NotFoundError, ConflictError, UnprocessableEntityError, ValidationError } from '../errors/AppError.js';
import { computeSeating } from './seating.js';
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

export function createSlotService({ slotDao, hutDao, timeZone, now = () => new Date() }) {
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
        const seating = computeSeating(partySize, tables);
        if (!seating) continue;

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
