import { NotFoundError, ConflictError, UnprocessableEntityError, ValidationError } from '../errors/AppError.js';
import { computeSeating } from './seating.js';

const ALLOWED_MEALS = ['breakfast', 'lunch', 'aperitivo', 'dinner'];

function isPastSlot(slot) {
  const now = new Date();
  const slotDate = new Date(`${slot.date}T${slot.start_time}:00`);
  return slotDate.getTime() <= now.getTime();
}

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

function parseSlotId(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const id = Number(value.trim());
    return id > 0 ? id : null;
  }
  return null;
}

export function createSlotService({ slotDao }) {
  async function loadContext(slotId) {
    const slot = await slotDao.findById(slotId);
    if (!slot) throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');
    const tables = await slotDao.getTablesForSlot(slotId);
    const freeMap = await slotDao.getFreeSeats(slotId);
    const tablesWithFree = tables.map((t) => ({
      id: t.id,
      label: t.label,
      seats: t.seats,
      free: freeMap instanceof Map ? (freeMap.get(t.id) ?? t.seats) : (freeMap?.[t.id] ?? t.seats),
    }));
    return { slot, tablesWithFree };
  }

  return {
    async listAvailableSlots(query) {
      const { date, meal, partySize } = validateSlotsQuery(query);
      const slots = await slotDao.listByDate(date);
      const result = [];
      for (const slot of slots) {
        if (slot.status !== 'available') continue;
        if (slot.meal !== meal) continue;
        if (isPastSlot(slot)) continue;
        const { tablesWithFree } = await loadContext(slot.id);
        const seating = computeSeating(partySize, tablesWithFree);
        if (!seating) continue;
        result.push({ id: slot.id, startTime: slot.start_time });
      }
      result.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id - b.id);
      return { date, meal, partySize, slots: result };
    },

    async getSeating(slotIdRaw, partySizeOrQuery) {
      // The contract only defines 400 for the partySize query parameter;
      // an unknown slot id is reported as SLOT_NOT_FOUND (404).
      const details = [];
      let partySizeRaw = partySizeOrQuery;
      if (partySizeOrQuery && typeof partySizeOrQuery === 'object' && !Array.isArray(partySizeOrQuery)) {
        const q = partySizeOrQuery;
        const allowed = ['partySize'];
        for (const key of Object.keys(q)) {
          if (!allowed.includes(key)) {
            details.push({ field: key, rule: 'unknown', message: `${key} is not allowed.` });
          }
        }
        partySizeRaw = q.partySize;
      }

      let partySize = null;
      if (partySizeRaw === undefined || partySizeRaw === null || partySizeRaw === '') {
        details.push({ field: 'partySize', rule: 'required', message: 'partySize is required.' });
      } else {
        partySize = validatePartySize(partySizeRaw);
        if (partySize === null) details.push({ field: 'partySize', rule: 'invalid', message: 'partySize is invalid.' });
      }
      if (details.length > 0) {
        throw new ValidationError('The request contains invalid fields.', 'VALIDATION_ERROR', details);
      }

      const slotId = parseSlotId(slotIdRaw);
      if (slotId === null) throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');

      const { slot, tablesWithFree } = await loadContext(slotId);
      if (slot.status !== 'available') {
        throw new ConflictError('Slot is not available.', 'SLOT_NOT_AVAILABLE');
      }
      const seating = computeSeating(partySize, tablesWithFree);
      if (!seating) {
        throw new ConflictError('Insufficient capacity.', 'INSUFFICIENT_CAPACITY', []);
      }
      if (isPastSlot(slot)) {
        throw new UnprocessableEntityError('Slot is in the past.', 'SLOT_IN_THE_PAST');
      }

      const requiresConfirmation = seating.fit === 'split';
      const response = {
        slotId: slot.id,
        partySize,
        fit: seating.fit,
        requiresConfirmation,
        seatAssignments: seating.assignments,
      };
      if (requiresConfirmation) {
        response.confirmation = {
          code: 'GROUP_SPLIT',
          message: 'There is no single table for the whole group. The party will be split across tables. Do you still want to book?',
        };
      }
      return response;
    },
  };
}