import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSlotService } from '../../../../src/services/slotService.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../../src/errors/AppError.js';

/** Slot creation, staff listing and seating preview: the MH-02 paths of slotService. */
describe('slotService staff flows - White-Box Tests', () => {
  const timeZone = 'Europe/Rome';
  const fixedNow = new Date('2026-08-14T07:00:00.000Z'); // 09:00 local time
  const staff = { id: 1, role: 'warden' };

  const body = (overrides = {}) => ({
    date: '2026-08-15',
    startTime: '12:00',
    endTime: '13:00',
    meal: 'lunch',
    ...overrides,
  });

  const storedSlot = {
    id: 50,
    date: '2026-08-15',
    start_time: '12:00',
    end_time: '13:00',
    status: 'available',
    meal: 'lunch',
  };

  let slotDao;
  let db;
  let service;

  /** Runs createSlot and returns the ValidationError details. */
  async function detailsOf(requestBody) {
    const err = await service.createSlot(staff, requestBody).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    return err.details;
  }

  beforeEach(() => {
    db = { transaction: vi.fn(async (callback) => callback('mock-tx')) };
    slotDao = {
      findMealByType: vi.fn().mockResolvedValue({ id: 2, meal_type: 'lunch' }),
      listByDate: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(storedSlot),
      getTableSetForSlot: vi.fn().mockResolvedValue([]),
      createSlot: vi.fn().mockResolvedValue(50),
      addTableToSlot: vi.fn().mockResolvedValue(),
      findTableByLabel: vi.fn().mockResolvedValue(null),
      createTable: vi.fn().mockResolvedValue(70),
      getTablesWithFreeForSlot: vi.fn().mockResolvedValue([]),
      getTablesWithFreeForSlots: vi.fn().mockResolvedValue([]),
    };
    service = createSlotService({ slotDao, db, timeZone, now: () => fixedNow });
  });

  describe('createSlot validation', () => {
    it('should report unknown fields', async () => {
      expect(await detailsOf(body({ hutId: 1 }))).toContainEqual(
        expect.objectContaining({ field: 'hutId', rule: 'unknown' })
      );
    });

    it('should report every missing required field at once', async () => {
      const fields = (await detailsOf({})).map((d) => d.field);

      expect(fields).toEqual(expect.arrayContaining(['date', 'startTime', 'endTime', 'meal']));
    });

    it('should reject malformed date, times and meal', async () => {
      const details = await detailsOf({ date: '2026-02-31', startTime: '25:00', endTime: '9:00', meal: 'brunch' });

      expect(details.map((d) => d.field)).toEqual(['date', 'startTime', 'endTime', 'meal']);
      expect(details.every((d) => d.rule === 'invalid')).toBe(true);
    });

    it('should reject tables that are not an array', async () => {
      expect(await detailsOf(body({ tables: 'T1' }))).toContainEqual(
        expect.objectContaining({ field: 'tables', rule: 'invalid' })
      );
    });

    it('should reject a table entry that is not an object', async () => {
      expect(await detailsOf(body({ tables: ['T1'] }))).toContainEqual(
        expect.objectContaining({ field: 'tables[0]', rule: 'invalid' })
      );
    });

    it('should report unknown table fields', async () => {
      const tables = [{ tableIdentifier: 'T1', seats: 4, shape: 'round' }];

      expect(await detailsOf(body({ tables }))).toContainEqual(
        expect.objectContaining({ field: 'tables[0].shape', rule: 'unknown' })
      );
    });

    it('should reject sending both tableIdentifier and tableLabel', async () => {
      const tables = [{ tableIdentifier: 'T1', tableLabel: 'T1', seats: 4 }];

      expect(await detailsOf(body({ tables }))).toContainEqual(
        expect.objectContaining({ field: 'tables[0].tableIdentifier', rule: 'conflict' })
      );
    });

    it('should require a table name and treat a blank one as missing', async () => {
      const details = await detailsOf(body({ tables: [{ seats: 4 }, { tableIdentifier: '   ', seats: 4 }] }));

      expect(details).toContainEqual(expect.objectContaining({ field: 'tables[0].tableIdentifier', rule: 'required' }));
      expect(details).toContainEqual(expect.objectContaining({ field: 'tables[1].tableIdentifier', rule: 'required' }));
    });

    it('should reject a table name that is not a string', async () => {
      expect(await detailsOf(body({ tables: [{ tableIdentifier: 5, seats: 4 }] }))).toContainEqual(
        expect.objectContaining({ field: 'tables[0].tableIdentifier', rule: 'invalid' })
      );
    });

    it('should name tableLabel in errors when that is the field sent', async () => {
      const tables = [{ tableLabel: 'x'.repeat(51), seats: 4 }];

      expect(await detailsOf(body({ tables }))).toContainEqual(
        expect.objectContaining({ field: 'tables[0].tableLabel', rule: 'too_long' })
      );
    });

    it('should only accept seats as a positive integer', async () => {
      const tables = [{ tableIdentifier: 'T1', seats: 0 }];

      expect(await detailsOf(body({ tables }))).toContainEqual(
        expect.objectContaining({ field: 'tables[0].seats', rule: 'invalid' })
      );
    });

    it('should reject duplicates after trimming the label', async () => {
      const tables = [
        { tableIdentifier: 'T1', seats: 4 },
        { tableIdentifier: ' T1 ', seats: 2 },
      ];

      expect(await detailsOf(body({ tables }))).toContainEqual(
        expect.objectContaining({ field: 'tables[1].tableIdentifier', rule: 'duplicate' })
      );
    });

    it('should reject an invalid copyTablesFromSlotId', async () => {
      expect(await detailsOf(body({ copyTablesFromSlotId: 'abc' }))).toContainEqual(
        expect.objectContaining({ field: 'copyTablesFromSlotId', rule: 'invalid' })
      );
    });

    it('should reject tables together with copyTablesFromSlotId', async () => {
      const tables = [{ tableIdentifier: 'T1', seats: 4 }];

      expect(await detailsOf(body({ tables, copyTablesFromSlotId: 3 }))).toContainEqual(
        expect.objectContaining({ field: 'tables', rule: 'conflict' })
      );
    });

    it('should flag the date when the slot is on a past day', async () => {
      expect(await detailsOf(body({ date: '2026-08-13' }))).toEqual([
        expect.objectContaining({ field: 'date', rule: 'past' }),
      ]);
    });

    it('should flag the start time when the slot is earlier today', async () => {
      const details = await detailsOf(body({ date: '2026-08-14', startTime: '08:00', endTime: '08:30' }));

      expect(details).toEqual([expect.objectContaining({ field: 'startTime', rule: 'past' })]);
    });
  });

  describe('createSlot persistence', () => {
    it('should reject a meal type missing from the database', async () => {
      slotDao.findMealByType.mockResolvedValue(null);

      await expect(service.createSlot(staff, body())).rejects.toThrow(ValidationError);
      expect(slotDao.createSlot).not.toHaveBeenCalled();
    });

    it('should reuse existing tables, create new ones and run in one transaction', async () => {
      slotDao.findTableByLabel.mockImplementation(async (_tx, label) => (label === 'T1' ? { id: 1 } : null));

      await service.createSlot(staff, body({
        tables: [
          { tableIdentifier: 'T1', seats: 4 },
          { tableLabel: ' T2 ', seats: 2 },
        ],
      }));

      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(slotDao.createTable).toHaveBeenCalledTimes(1);
      expect(slotDao.createTable).toHaveBeenCalledWith('mock-tx', { label: 'T2' });
      expect(slotDao.addTableToSlot).toHaveBeenCalledWith('mock-tx', 50, 1, 4);
      expect(slotDao.addTableToSlot).toHaveBeenCalledWith('mock-tx', 50, 70, 2);
    });

    it('should create the slot directly when no transaction support exists', async () => {
      service = createSlotService({ slotDao, timeZone, now: () => fixedNow });

      const result = await service.createSlot(staff, body());

      expect(result.id).toBe(50);
    });

    it('should copy the table set of the source slot', async () => {
      slotDao.getTableSetForSlot.mockResolvedValue([{ tableId: 3, seats: 6 }]);

      await service.createSlot(staff, body({ copyTablesFromSlotId: 9 }));

      expect(slotDao.findById).toHaveBeenCalledWith('mock-tx', 9);
      expect(slotDao.addTableToSlot).toHaveBeenCalledWith('mock-tx', 50, 3, 6);
      expect(slotDao.createTable).not.toHaveBeenCalled();
    });

    it('should answer 404 when the source slot does not exist', async () => {
      slotDao.findById.mockResolvedValueOnce(null);

      await expect(service.createSlot(staff, body({ copyTablesFromSlotId: 9 }))).rejects.toThrow(NotFoundError);
      expect(slotDao.createSlot).not.toHaveBeenCalled();
    });

    it('should turn the database overlap trigger into a SLOT_OVERLAP conflict', async () => {
      slotDao.createSlot.mockRejectedValue(new Error('Trigger: slot overlaps another slot'));

      await expect(service.createSlot(staff, body())).rejects.toMatchObject({ code: 'SLOT_OVERLAP', status: 409 });
    });

    it('should rethrow unexpected database errors unchanged', async () => {
      const failure = new Error('disk full');
      slotDao.createSlot.mockRejectedValue(failure);

      await expect(service.createSlot(staff, body())).rejects.toBe(failure);
    });
  });

  describe('createSlot overlap detection', () => {
    const existing = { id: 7, start_time: '12:00', end_time: '13:00' };

    async function overlapOf(startTime, endTime, daySlots = [existing]) {
      slotDao.listByDate.mockResolvedValue(daySlots);
      const err = await service.createSlot(staff, body({ startTime, endTime })).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictError);
      return err.details[0];
    }

    it('should suggest an earlier end when the new slot starts first', async () => {
      expect(await overlapOf('11:30', '12:30')).toMatchObject({
        field: 'endTime',
        overlapsSlotId: 7,
        suggestedEndTime: '12:00',
      });
    });

    it('should suggest a later start when the new slot starts inside the other', async () => {
      expect(await overlapOf('12:30', '13:30')).toMatchObject({
        field: 'startTime',
        overlapsSlotId: 7,
        suggestedStartTime: '13:00',
      });
    });

    it('should skip past back-to-back slots when suggesting a start', async () => {
      const next = { id: 8, start_time: '13:00', end_time: '14:00' };

      expect(await overlapOf('12:30', '13:30', [next, existing])).toMatchObject({ suggestedStartTime: '14:00' });
    });

    it('should allow a slot that starts exactly when another ends', async () => {
      slotDao.listByDate.mockResolvedValue([existing]);

      await service.createSlot(staff, body({ startTime: '13:00', endTime: '14:00' }));

      expect(slotDao.createSlot).toHaveBeenCalledTimes(1);
    });
  });

  describe('listSlots', () => {
    const lunch = { id: 1, date: '2026-08-14', start_time: '12:00', end_time: '13:30', status: 'available', meal: 'lunch' };
    const dinner = { id: 2, date: '2026-08-14', start_time: '19:00', end_time: '20:00', status: 'available', meal: 'dinner' };

    beforeEach(() => {
      slotDao.listByDate.mockResolvedValue([lunch, dinner]);
    });

    it('should default to today in hut time', async () => {
      const result = await service.listSlots(staff, undefined);

      expect(slotDao.listByDate).toHaveBeenCalledWith('2026-08-14');
      expect(result.date).toBe('2026-08-14');
      expect(result.slots.map((s) => s.id)).toEqual([1, 2]);
    });

    it('should filter by meal and attach each slot its own tables', async () => {
      slotDao.getTablesWithFreeForSlots.mockResolvedValue([{ slot_id: 2, id: 9, label: 'T9', seats: '4', free: '3' }]);

      const result = await service.listSlots(staff, { date: '2026-08-14', meal: 'dinner' });

      expect(slotDao.getTablesWithFreeForSlots).toHaveBeenCalledWith([2]);
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0]).toMatchObject({
        id: 2,
        durationMinutes: 60,
        tables: [{ tableId: 9, tableIdentifier: 'T9', tableLabel: 'T9', seats: 4, freeSeats: 3 }],
      });
    });

    it('should reject an invalid date and meal together', async () => {
      const err = await service.listSlots(staff, { date: 'nope', meal: 'brunch' }).catch((e) => e);

      expect(err).toBeInstanceOf(ValidationError);
      expect(err.details.map((d) => d.field)).toEqual(['date', 'meal']);
    });
  });

  describe('getSlot', () => {
    it('should answer 404 for an id that is not a positive integer', async () => {
      await expect(service.getSlot(staff, 'abc')).rejects.toThrow(NotFoundError);
      expect(slotDao.findById).not.toHaveBeenCalled();
    });
  });

  describe('getSeating', () => {
    const openSlot = { id: 5, date: '2026-08-14', start_time: '14:00', end_time: '15:00', status: 'available' };

    beforeEach(() => {
      slotDao.findById.mockResolvedValue(openSlot);
    });

    it('should report a single-table fit without asking for confirmation', async () => {
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([{ id: 1, label: 'T1', seats: 4, free: 4 }]);

      const result = await service.getSeating(5, { partySize: '2' });

      expect(result).toMatchObject({ slotId: 5, partySize: 2, fit: 'single_table', requiresConfirmation: false, availableSeats: 4 });
      expect(result).not.toHaveProperty('confirmation');
    });

    it('should ask for confirmation when the group has to be split', async () => {
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 },
        { id: 2, label: 'T2', seats: 4, free: 4 },
      ]);

      const result = await service.getSeating(5, { partySize: '6' });

      expect(result).toMatchObject({ fit: 'split', requiresConfirmation: true, confirmation: { code: 'GROUP_SPLIT' } });
    });

    it('should answer 409 when the party does not fit', async () => {
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([{ id: 1, label: 'T1', seats: 2, free: 1 }]);

      await expect(service.getSeating(5, { partySize: '4' })).rejects.toMatchObject({ code: 'INSUFFICIENT_CAPACITY' });
    });
  });

  describe('listAvailableSlots', () => {
    it('should drop slots that cannot seat the party and sort the rest', async () => {
      slotDao.listByDate.mockResolvedValue([
        { id: 3, date: '2026-08-15', start_time: '14:00', end_time: '15:00', status: 'available', meal: 'lunch' },
        { id: 1, date: '2026-08-15', start_time: '12:00', end_time: '13:00', status: 'available', meal: 'lunch' },
        { id: 2, date: '2026-08-15', start_time: '13:00', end_time: '14:00', status: 'available', meal: 'lunch' },
        { id: 4, date: '2026-08-15', start_time: '15:00', end_time: '16:00', status: 'closed', meal: 'lunch' },
      ]);
      slotDao.getTablesWithFreeForSlots.mockResolvedValue([
        { slot_id: 1, id: 1, label: 'T1', seats: 4, free: 4 },
        { slot_id: 2, id: 1, label: 'T1', seats: 4, free: 0 },
        { slot_id: 3, id: 1, label: 'T1', seats: 4, free: 4 },
      ]);

      const result = await service.listAvailableSlots({ date: '2026-08-15', meal: 'lunch', partySize: '2' });

      expect(slotDao.getTablesWithFreeForSlots).toHaveBeenCalledWith([3, 1, 2]);
      expect(result.slots.map((s) => s.id)).toEqual([1, 3]);
      expect(result.slots[0]).toMatchObject({ availableSeats: 4, tables: [{ tableId: 1, tableLabel: 'T1', seats: 4, freeSeats: 4 }] });
    });
  });
});
