import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSlotService } from '../../../../src/services/slotService.js';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
} from '../../../../src/errors/AppError.js';

describe('slotService - Black-Box Tests', () => {
  let slotDao;
  let db;
  let slotService;
  const timeZone = 'Europe/Rome';
  const fixedNow = new Date('2026-08-14T07:00:00.000Z');

  const mockStaff = {
    id: 1,
    displayName: 'Warden Staff',
    role: 'warden',
  };

  const mockHiker = {
    id: 10,
    displayName: 'Mario Rossi',
    role: 'hiker',
  };

  beforeEach(() => {
    slotDao = {
      listByDate: vi.fn(),
      listByDateRange: vi.fn(),
      getTablesWithFreeForSlot: vi.fn(),
      getTablesWithFreeForSlots: vi.fn(),
      getTableSetForSlot: vi.fn(),
      getTableSetForSlots: vi.fn(),
      findById: vi.fn(),
      findMealAt: vi.fn(),
      findMealByType: vi.fn(),
      createSlot: vi.fn(),
      clearSlotsByDateRange: vi.fn(),
      addTableToSlot: vi.fn(),
      findTableByLabel: vi.fn(),
      createTable: vi.fn(),
      deleteTable: vi.fn(),
      listTables: vi.fn(),
      listTimePatterns: vi.fn(),
      hasAnyConfirmedBookingInRange: vi.fn(),
    };

    db = {
      transaction: vi.fn(async (fn) => fn(slotDao)),
    };

    slotService = createSlotService({
      slotDao,
      db,
      timeZone,
      now: () => fixedNow,
    });
  });

  describe('listAvailableSlots', () => {
    it('should throw a ValidationError if required query parameters are missing', async () => {
      await expect(
        slotService.listAvailableSlots({ date: '2026-08-14' })
      ).rejects.toThrow(ValidationError);
    });

    it('should return filtered and sorted available slots successfully including meal property', async () => {
      slotDao.listByDate.mockResolvedValue([
        { id: 101, date: '2026-08-14', start_time: '14:00', end_time: '15:00', meal: 'lunch', status: 'available' },
        { id: 102, date: '2026-08-14', start_time: '12:00', end_time: '13:00', meal: 'lunch', status: 'available' },
        { id: 103, date: '2026-08-14', start_time: '12:00', end_time: '13:00', meal: 'dinner', status: 'available' },
      ]);

      slotDao.getTablesWithFreeForSlots.mockResolvedValue([
        { slot_id: 101, id: 1, label: 'T1', seats: 4, free: 4 },
        { slot_id: 102, id: 1, label: 'T1', seats: 4, free: 4 },
      ]);

      const result = await slotService.listAvailableSlots({
        date: '2026-08-14',
        meal: 'lunch',
        partySize: '2',
      });

      expect(result).toEqual({
        date: '2026-08-14',
        meal: 'lunch',
        partySize: 2,
        slots: [
          {
            id: 102,
            startTime: '12:00',
            endTime: '13:00',
            meal: 'lunch',
            availableSeats: 4,
            tables: [{ tableId: 1, tableLabel: 'T1', seats: 4, freeSeats: 4 }],
          },
          {
            id: 101,
            startTime: '14:00',
            endTime: '15:00',
            meal: 'lunch',
            availableSeats: 4,
            tables: [{ tableId: 1, tableLabel: 'T1', seats: 4, freeSeats: 4 }],
          },
        ],
      });
    });

    it('should include slots within hiker cut-off when staff mode is enabled', async () => {
      // fixedNow is 2026-08-14T07:00:00.000Z -> 09:00 in Europe/Rome (CEST, UTC+2).
      // A slot at 09:30 is too late for hikers (2h lead) but allowed for staff.
      const slots = [
        { id: 201, date: '2026-08-14', start_time: '09:30', end_time: '10:30', meal: 'breakfast', status: 'available' },
      ];
      const tables = [{ slot_id: 201, id: 1, label: 'T1', seats: 4, free: 4 }];

      slotDao.listByDate.mockResolvedValueOnce(slots);
      slotDao.getTablesWithFreeForSlots.mockResolvedValueOnce([]);

      const hikerRes = await slotService.listAvailableSlots({
        date: '2026-08-14',
        meal: 'breakfast',
        partySize: 2,
      });
      expect(hikerRes.slots).toHaveLength(0);

      slotDao.listByDate.mockResolvedValueOnce(slots);
      slotDao.getTablesWithFreeForSlots.mockResolvedValueOnce(tables);

      const staffRes = await slotService.listAvailableSlots(
        { date: '2026-08-14', meal: 'breakfast', partySize: 2 },
        { staff: true }
      );
      expect(staffRes.slots.map((s) => s.id)).toEqual([201]);
    });
  });

  describe('getSeating', () => {
    it('should throw a ValidationError if partySize is invalid', async () => {
      await expect(
        slotService.getSeating(101, { partySize: 'invalid' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw a NotFoundError if the slot does not exist', async () => {
      slotDao.findById.mockResolvedValue(null);

      await expect(
        slotService.getSeating(101, { partySize: '2' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw a ConflictError if the slot is not available', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'booked',
        start_time: '14:00',
        date: '2026-08-14',
      });

      await expect(
        slotService.getSeating(101, { partySize: '2' })
      ).rejects.toThrow(ConflictError);
    });

    it('should throw an UnprocessableEntityError if the slot is too late to book', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        start_time: '10:30',
        date: '2026-08-14',
      });

      await expect(
        slotService.getSeating(101, { partySize: '2' })
      ).rejects.toThrow(UnprocessableEntityError);
    });

    it('should return split confirmation metadata when seating across multiple tables', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        date: '2026-08-14',
        start_time: '14:00',
        end_time: '15:00',
        status: 'available',
        meal: 'lunch',
      });
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 3, free: 3 },
        { id: 2, label: 'T2', seats: 3, free: 3 },
      ]);

      const seating = await slotService.getSeating(101, { partySize: 5 });
      expect(seating.fit).toBe('split');
      expect(seating.requiresConfirmation).toBe(true);
      expect(seating.confirmation?.code).toBe('GROUP_SPLIT');
    });

    it('should allow staff to seat a party within the hiker cut-off window', async () => {
      slotDao.findById.mockResolvedValue({
        id: 201,
        date: '2026-08-14',
        start_time: '09:30',
        end_time: '10:30',
        status: 'available',
        meal: 'breakfast',
      });
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 },
      ]);

      const seating = await slotService.getSeating(201, { partySize: 2 }, { staff: true });
      expect(seating.slotId).toBe(201);
      expect(seating.partySize).toBe(2);
    });
  });

  describe('Staff Slot Management (getSlot, listSlots, createSlot)', () => {
    it('should throw ForbiddenError if a non-staff user tries to retrieve a slot', async () => {
      await expect(slotService.getSlot(mockHiker, 101)).rejects.toThrow();
    });

    it('should successfully retrieve slot details for staff', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        date: '2026-08-14',
        start_time: '12:00',
        end_time: '13:00',
        status: 'available',
        meal: 'lunch',
      });
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 },
      ]);

      const result = await slotService.getSlot(mockStaff, 101);
      expect(result.id).toBe(101);
      expect(result.tables.length).toBe(1);
    });

    it('should successfully create a new slot when valid body and staff user are provided', async () => {
      slotDao.findMealByType.mockResolvedValue({
        id: 2,
        meal_type: 'lunch',
      });
      slotDao.listByDate.mockResolvedValue([]);
      slotDao.createSlot.mockResolvedValue(105);
      slotDao.findTableByLabel.mockResolvedValue({ id: 1, seats: 4 });
      slotDao.addTableToSlot.mockResolvedValue();

      slotDao.findById.mockResolvedValue({
        id: 105,
        date: '2026-08-14',
        start_time: '12:30',
        end_time: '13:30',
        status: 'available',
        meal: 'lunch',
      });
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 },
      ]);

      const result = await slotService.createSlot(mockStaff, {
        date: '2026-08-14',
        startTime: '12:30',
        endTime: '13:30',
        meal: 'lunch',
        tables: [{ tableIdentifier: 'T1', seats: 4 }],
      });

      expect(result.id).toBe(105);
      expect(slotDao.createSlot).toHaveBeenCalled();
    });
  });

  describe('createSlot - Edge Cases & Validations', () => {
    it('should throw a ConflictError if the new slot overlaps with an existing slot', async () => {
      slotDao.findMealByType.mockResolvedValue({ id: 2, meal_type: 'lunch' });
      slotDao.listByDate.mockResolvedValue([
        { id: 101, start_time: '12:00', end_time: '13:00' },
      ]);

      await expect(
        slotService.createSlot(mockStaff, {
          date: '2026-08-14',
          startTime: '12:30',
          endTime: '13:30',
          meal: 'lunch',
          tables: [{ tableIdentifier: 'T1', seats: 4 }],
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should successfully create a slot by copying tables from another existing slot', async () => {
      slotDao.findMealByType.mockResolvedValue({ id: 2, meal_type: 'lunch' });
      slotDao.listByDate.mockResolvedValue([]);

      slotDao.findById
        .mockResolvedValueOnce({ id: 99, date: '2026-08-13' })
        .mockResolvedValueOnce({
          id: 106,
          date: '2026-08-14',
          start_time: '15:00',
          end_time: '16:00',
          status: 'available',
          meal: 'lunch',
        });

      slotDao.getTableSetForSlot.mockResolvedValue([{ tableId: 1, seats: 4 }]);
      slotDao.createSlot.mockResolvedValue(106);
      slotDao.addTableToSlot.mockResolvedValue();
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 },
      ]);

      const result = await slotService.createSlot(mockStaff, {
        date: '2026-08-14',
        startTime: '15:00',
        endTime: '16:00',
        meal: 'lunch',
        copyTablesFromSlotId: 99,
      });

      expect(result.id).toBe(106);
      expect(slotDao.getTableSetForSlot).toHaveBeenCalled();
    });

    it('should reject creating a slot in the past', async () => {
      await expect(
        slotService.createSlot(mockStaff, {
          date: '2026-08-13',
          startTime: '12:00',
          endTime: '13:00',
          meal: 'lunch',
          tables: [{ tableIdentifier: 'T1', seats: 4 }],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject when endTime is not strictly after startTime or conflicting fields are sent', async () => {
      await expect(
        slotService.createSlot(mockStaff, {
          date: '2026-08-14',
          startTime: '14:00',
          endTime: '14:00',
          meal: 'lunch',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        slotService.createSlot(mockStaff, {
          date: '2026-08-14',
          startTime: '14:00',
          endTime: '15:00',
          meal: 'lunch',
          tables: [{ tableIdentifier: 'T1', seats: 4 }],
          copyTablesFromSlotId: 99,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError when an existing table has a different capacity', async () => {
      slotDao.findMealByType.mockResolvedValue({ id: 2, meal_type: 'lunch' });
      slotDao.listByDate.mockResolvedValue([]);
      slotDao.createSlot.mockResolvedValue(107);
      slotDao.findTableByLabel.mockResolvedValue({ id: 1, seats: 4 });

      await expect(
        slotService.createSlot(mockStaff, {
          date: '2026-08-14',
          startTime: '16:00',
          endTime: '17:00',
          meal: 'lunch',
          tables: [{ tableIdentifier: 'T1', seats: 6 }],
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should throw NotFoundError when copyTablesFromSlotId does not exist', async () => {
      slotDao.findMealByType.mockResolvedValue({ id: 2, meal_type: 'lunch' });
      slotDao.listByDate.mockResolvedValue([]);
      slotDao.findById.mockResolvedValue(null);

      await expect(
        slotService.createSlot(mockStaff, {
          date: '2026-08-14',
          startTime: '16:00',
          endTime: '17:00',
          meal: 'lunch',
          copyTablesFromSlotId: 999,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Catalog management (listCatalog, createCatalogTable, deleteCatalogTable)', () => {
    it('should list tables and time patterns for staff and reject non-staff', async () => {
      slotDao.listTables.mockResolvedValue([{ id: 1, label: 'T1', seats: 4 }]);
      slotDao.listTimePatterns.mockResolvedValue([{ id: 1, meal: 'lunch' }]);

      await expect(slotService.listCatalog(mockHiker)).rejects.toThrow();

      const catalog = await slotService.listCatalog(mockStaff);
      expect(catalog.tables).toEqual([{ tableId: 1, tableIdentifier: 'T1', seats: 4 }]);
      expect(catalog.timePatterns).toHaveLength(1);
    });

    it('should create a catalog table and reject duplicate or invalid inputs', async () => {
      slotDao.findTableByLabel.mockResolvedValueOnce(null);
      slotDao.createTable.mockResolvedValueOnce(5);

      const created = await slotService.createCatalogTable(mockStaff, {
        tableIdentifier: 'T5',
        seats: 4,
      });
      expect(created).toEqual({ tableId: 5, tableIdentifier: 'T5', seats: 4 });

      slotDao.findTableByLabel.mockResolvedValueOnce({ id: 5, label: 'T5', seats: 4 });
      await expect(
        slotService.createCatalogTable(mockStaff, { tableIdentifier: 'T5', seats: 4 })
      ).rejects.toThrow(ConflictError);

      await expect(
        slotService.createCatalogTable(mockStaff, { tableIdentifier: '', seats: 4 })
      ).rejects.toThrow(ValidationError);
    });

    it('should delete a catalog table or throw NotFoundError / ConflictError when in use', async () => {
      slotDao.deleteTable.mockResolvedValueOnce(true);
      await expect(slotService.deleteCatalogTable(mockStaff, 5)).resolves.toBeUndefined();

      slotDao.deleteTable.mockResolvedValueOnce(false);
      await expect(slotService.deleteCatalogTable(mockStaff, 999)).rejects.toThrow(NotFoundError);

      const fkError = Object.assign(new Error('FK violation'), { code: '23503' });
      slotDao.deleteTable.mockRejectedValueOnce(fkError);
      await expect(slotService.deleteCatalogTable(mockStaff, 5)).rejects.toThrow(ConflictError);
    });
  });

  describe('Weekly copy (previewWeeklyCopy & copyWeeklySchedule)', () => {
    it('should validate week dates and Monday constraints', async () => {
      // 2026-08-17 is Monday; 2026-08-18 is Tuesday
      await expect(
        slotService.previewWeeklyCopy(mockStaff, {
          sourceWeekStart: '2026-08-18',
          targetWeekStart: '2026-08-24',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        slotService.previewWeeklyCopy(mockStaff, {
          sourceWeekStart: '2026-08-17',
          targetWeekStart: '2026-08-10',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should preview and copy a week schedule while rejecting stale previews', async () => {
      slotDao.hasAnyConfirmedBookingInRange.mockResolvedValue(false);
      slotDao.getTableSetForSlots.mockResolvedValue(new Map([[10, [{ tableId: 1, seats: 4 }]]]));
      slotDao.clearSlotsByDateRange.mockResolvedValue();
      slotDao.createSlot.mockResolvedValue(50);
      slotDao.addTableToSlot.mockResolvedValue();

      const sourceSlots = [
        { id: 10, date: '2026-08-17', start_time: '12:00', end_time: '13:00', meal_id: 2, status: 'available' },
      ];

      slotDao.listByDateRange
        .mockResolvedValueOnce(sourceSlots)
        .mockResolvedValueOnce([]);

      const preview = await slotService.previewWeeklyCopy(mockStaff, {
        sourceWeekStart: '2026-08-17',
        targetWeekStart: '2026-08-24',
      });
      expect(preview.sourceCount).toBe(1);
      expect(preview.targetCount).toBe(0);

      slotDao.listByDateRange
        .mockResolvedValueOnce(sourceSlots)
        .mockResolvedValueOnce([]);
      await expect(
        slotService.copyWeeklySchedule(mockStaff, {
          sourceWeekStart: '2026-08-17',
          targetWeekStart: '2026-08-24',
          expectedRevision: 'wrong-revision',
        })
      ).rejects.toThrow(ConflictError);

      slotDao.listByDateRange
        .mockResolvedValueOnce(sourceSlots)
        .mockResolvedValueOnce([]);
      const copied = await slotService.copyWeeklySchedule(mockStaff, {
        sourceWeekStart: '2026-08-17',
        targetWeekStart: '2026-08-24',
        expectedRevision: preview.revision,
      });
      expect(copied).toEqual({ targetWeekStart: '2026-08-24', copiedCount: 1 });
      expect(slotDao.clearSlotsByDateRange).toHaveBeenCalledWith(slotDao, '2026-08-24', '2026-08-30');
    });
  });

  describe('listSlots (Staff Query Validation)', () => {
    it('should throw ValidationError if date format is invalid in listSlots query', async () => {
      await expect(
        slotService.listSlots(mockStaff, { date: 'invalid-date' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if meal type is not allowed in listSlots query', async () => {
      await expect(
        slotService.listSlots(mockStaff, { meal: 'midnight-snack' })
      ).rejects.toThrow(ValidationError);
    });
  });
});