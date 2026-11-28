import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSlotService } from '../../../../src/services/slotService.js';
import {
  ValidationError,
  ForbiddenError,
  ConflictError,
  NotFoundError,
} from '../../../../src/errors/AppError.js';

describe('slotService - White-Box Tests', () => {
  let slotDao;
  let db;
  let slotService;
  const timeZone = 'Europe/Rome';
  const fixedNow = new Date('2026-08-14T07:00:00.000Z'); // 09:00 local time

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
      getTableSetForSlot: vi.fn(),
      getTableSetForSlots: vi.fn(),
    };

    db = {
      transaction: vi.fn(async (callback) => callback(slotDao)),
    };

    slotService = createSlotService({
      slotDao,
      db,
      timeZone,
      now: () => fixedNow,
    });
  });

  describe('Internal Query Validation Branches (validateSlotsQuery)', () => {
    it('should report all missing query parameters at once', async () => {
      try {
        await slotService.listAvailableSlots({});
        expect.fail('Should have thrown a ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details.map((d) => d.field)).toEqual(['date', 'meal', 'partySize']);
      }
    });

    it('should trigger validateDate internal checks and fail for non-existent calendar dates (e.g., February 31st)', async () => {
      try {
        await slotService.listAvailableSlots({
          date: '2026-02-31',
          meal: 'lunch',
          partySize: '2',
        });
        expect.fail('Should have thrown a ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'date', rule: 'invalid' }),
          ])
        );
      }
    });

    it('should validate partySize robustly handling various formats through validatePartySize branch', async () => {
      try {
        await slotService.listAvailableSlots({
          date: '2026-08-14',
          meal: 'lunch',
          partySize: '0',
        });
        expect.fail('Should have thrown a ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'partySize', rule: 'invalid' }),
          ])
        );
      }
    });

    it('should validate meal format against allowed meals', async () => {
      try {
        await slotService.listAvailableSlots({
          date: '2026-08-14',
          meal: 'brunch',
          partySize: '2',
        });
        expect.fail('Should have thrown a ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'meal' }),
          ])
        );
      }
    });
  });

  describe('Internal Seating Query Validation Branches (validateSeatingQuery)', () => {
    it('should throw ValidationError if partySize is completely missing in seating query', async () => {
      slotDao.findById.mockResolvedValue({ id: 101, status: 'available' });

      try {
        await slotService.getSeating(101, {});
        expect.fail('Should have thrown a ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'partySize', rule: 'required' }),
          ])
        );
      }
    });

    it('should throw ValidationError if partySize is non-positive in seating query', async () => {
      try {
        await slotService.getSeating(101, { partySize: '-1' });
        expect.fail('Should have thrown a ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'partySize', rule: 'invalid' }),
          ])
        );
      }
    });
  });

  describe('Staff Authentication and Authorization (assertStaff)', () => {
    it('should throw ForbiddenError when a non-staff user attempts to execute staff-only operations', async () => {
      await expect(slotService.getSlot(mockHiker, 101)).rejects.toThrow(ForbiddenError);
      await expect(slotService.listCatalog(mockHiker)).rejects.toThrow(ForbiddenError);
      await expect(slotService.createCatalogTable(mockHiker, { tableIdentifier: 'T1', seats: 4 })).rejects.toThrow(ForbiddenError);
      await expect(slotService.deleteCatalogTable(mockHiker, 1)).rejects.toThrow(ForbiddenError);
      await expect(slotService.previewWeeklyCopy(mockHiker, {})).rejects.toThrow(ForbiddenError);
      await expect(slotService.copyWeeklySchedule(mockHiker, {})).rejects.toThrow(ForbiddenError);
    });

    it('should allow staff users to proceed past assertStaff check', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        date: '2026-08-14',
        start_time: '12:00',
        end_time: '13:00',
        status: 'available',
        meal: 'lunch',
      });
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([]);

      const result = await slotService.getSlot(mockStaff, 101);
      expect(result.id).toBe(101);
    });
  });

  describe('Internal CreateSlot Body Validation Branches (validateCreateSlotBody)', () => {
    it('should validate body structure and reject non-objects', async () => {
      try {
        await slotService.createSlot(mockStaff, ['not-an-object']);
        expect.fail('Should have thrown ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
      }
    });

    it('should detect invalid end times occurring before start times', async () => {
      try {
        await slotService.createSlot(mockStaff, {
          date: '2026-08-14',
          startTime: '14:00',
          endTime: '12:00',
          tables: [{ tableIdentifier: 'T1', seats: 4 }],
        });
        expect.fail('Should have thrown ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'endTime' }),
          ])
        );
      }
    });
  });

  describe('Internal Past-Time and Overlap Safety Net Branches', () => {
    it('should throw ValidationError if attempting to create a slot in the past', async () => {
      slotDao.findMealByType.mockResolvedValue({ id: 2, meal_type: 'lunch' });

      try {
        await slotService.createSlot(mockStaff, {
          date: '2026-08-14',
          startTime: '05:00',
          endTime: '06:00',
          meal: 'lunch',
          tables: [{ tableIdentifier: 'T1', seats: 4 }],
        });
        expect.fail('Should have thrown ValidationError for past slot');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ rule: 'past' }),
          ])
        );
      }
    });

    it('should catch database-level overlap errors in transaction safety net and wrap them as ConflictError', async () => {
      slotDao.findMealByType.mockResolvedValue({ id: 2, meal_type: 'lunch' });
      slotDao.listByDate.mockResolvedValue([]);
      slotDao.createSlot.mockRejectedValueOnce(new Error('sqlite error: overlaps another slot'));

      try {
        await slotService.createSlot(mockStaff, {
          date: '2026-08-14',
          startTime: '12:00',
          endTime: '13:00',
          meal: 'lunch',
          tables: [{ tableIdentifier: 'T1', seats: 4 }],
        });
        expect.fail('Should have thrown ConflictError');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError);
        expect(err.code).toBe('SLOT_OVERLAP');
      }
    });
  });

  describe('Internal Table Validation Branches (validateCreateSlotBody)', () => {
    it('should reject requests providing both tables and copyTablesFromSlotId (conflict)', async () => {
      try {
        await slotService.createSlot(mockStaff, {
          date: '2026-08-14',
          startTime: '12:00',
          endTime: '13:00',
          meal: 'lunch',
          tables: [{ tableIdentifier: 'T1', seats: 4 }],
          copyTablesFromSlotId: 50,
        });
        expect.fail('Should have thrown ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'tables', rule: 'conflict' }),
          ])
        );
      }
    });

    it('should reject when existing table capacity differs from catalog', async () => {
      slotDao.findMealByType.mockResolvedValue({ id: 2, meal_type: 'lunch' });
      slotDao.listByDate.mockResolvedValue([]);
      slotDao.createSlot.mockResolvedValue(105);
      slotDao.findTableByLabel.mockResolvedValue({ id: 1, seats: 4 });

      await expect(
        slotService.createSlot(mockStaff, {
          date: '2026-08-14',
          startTime: '12:00',
          endTime: '13:00',
          meal: 'lunch',
          tables: [{ tableIdentifier: 'T1', seats: 6 }],
        })
      ).rejects.toMatchObject({ code: 'TABLE_CAPACITY_MISMATCH' });
    });
  });

  describe('Catalog & Weekly Copy White-Box Branches', () => {
    it('should handle catalog CRUD and validation/conflict branches', async () => {
      slotDao.listTables.mockResolvedValue([{ id: 1, label: 'T1', seats: 4 }]);
      slotDao.listTimePatterns.mockResolvedValue([{ id: 10, meal: 'lunch' }]);

      const catalog = await slotService.listCatalog(mockStaff);
      expect(catalog).toEqual({
        tables: [{ tableId: 1, tableIdentifier: 'T1', seats: 4 }],
        timePatterns: [{ id: 10, meal: 'lunch' }],
      });

      await expect(
        slotService.createCatalogTable(mockStaff, { tableIdentifier: 'a'.repeat(51), seats: 4 })
      ).rejects.toThrow(ValidationError);

      await expect(
        slotService.createCatalogTable(mockStaff, { tableIdentifier: 'T1', seats: 0 })
      ).rejects.toThrow(ValidationError);

      slotDao.findTableByLabel.mockResolvedValueOnce({ id: 1, label: 'T1', seats: 4 });
      await expect(
        slotService.createCatalogTable(mockStaff, { tableIdentifier: 'T1', seats: 4 })
      ).rejects.toMatchObject({ code: 'TABLE_ALREADY_EXISTS' });

      slotDao.findTableByLabel.mockResolvedValueOnce(null);
      slotDao.createTable.mockResolvedValueOnce(2);
      await expect(
        slotService.createCatalogTable(mockStaff, { tableIdentifier: ' T2 ', seats: 6 })
      ).resolves.toEqual({ tableId: 2, tableIdentifier: 'T2', seats: 6 });

      await expect(slotService.deleteCatalogTable(mockStaff, 2147483648)).rejects.toThrow(ValidationError);

      slotDao.deleteTable.mockResolvedValueOnce(false);
      await expect(slotService.deleteCatalogTable(mockStaff, 99)).rejects.toThrow(NotFoundError);

      slotDao.deleteTable.mockRejectedValueOnce(Object.assign(new Error('fk'), { code: '23503' }));
      await expect(slotService.deleteCatalogTable(mockStaff, 1)).rejects.toMatchObject({ code: 'TABLE_IN_USE' });

      slotDao.deleteTable.mockResolvedValueOnce(true);
      await expect(slotService.deleteCatalogTable(mockStaff, 1)).resolves.toBeUndefined();
    });

    it('should cover weekly copy validation, conflicts, stale preview and copy execution', async () => {
      // Missing / invalid / order / past target week
      await expect(slotService.previewWeeklyCopy(mockStaff, {})).rejects.toThrow(ValidationError);
      await expect(
        slotService.previewWeeklyCopy(mockStaff, { sourceWeekStart: '2026-08-18', targetWeekStart: '2026-08-24' })
      ).rejects.toThrow(ValidationError);
      await expect(
        slotService.previewWeeklyCopy(mockStaff, { sourceWeekStart: '2026-08-17', targetWeekStart: '2026-08-14' })
      ).rejects.toThrow(ValidationError);
      await expect(
        slotService.previewWeeklyCopy(mockStaff, { sourceWeekStart: '2026-08-24', targetWeekStart: '2026-08-17' })
      ).rejects.toThrow(ValidationError);

      // Empty source week
      slotDao.listByDateRange.mockResolvedValueOnce([]);
      await expect(
        slotService.previewWeeklyCopy(mockStaff, { sourceWeekStart: '2026-08-17', targetWeekStart: '2026-08-24' })
      ).rejects.toThrow(ValidationError);

      // Confirmed booking conflict in destination week
      slotDao.listByDateRange.mockResolvedValueOnce([
        { id: 10, date: '2026-08-17', start_time: '12:00', end_time: '13:00', meal_id: 2, status: 'available' },
      ]);
      slotDao.hasAnyConfirmedBookingInRange.mockResolvedValueOnce(true);
      await expect(
        slotService.previewWeeklyCopy(mockStaff, { sourceWeekStart: '2026-08-17', targetWeekStart: '2026-08-24' })
      ).rejects.toMatchObject({ code: 'WEEKLY_COPY_CONFLICT' });

      // Valid preview + stale expectedSourceSlotIds / expectedTargetSlotIds + successful copy
      const srcSlots = [
        { id: 10, date: '2026-08-17', start_time: '12:00', end_time: '13:00', meal_id: 2, status: 'available' },
      ];
      const tgtSlots = [
        { id: 20, date: '2026-08-24', start_time: '12:00', end_time: '13:00', meal_id: 2, status: 'available' },
      ];
      slotDao.hasAnyConfirmedBookingInRange.mockResolvedValue(false);
      slotDao.getTableSetForSlots.mockResolvedValue(new Map([[10, [{ tableId: 1, seats: 4 }]], [20, []]]));
      slotDao.clearSlotsByDateRange.mockResolvedValue();
      slotDao.createSlot.mockResolvedValue(30);
      slotDao.addTableToSlot.mockResolvedValue();

      slotDao.listByDateRange.mockResolvedValueOnce(srcSlots).mockResolvedValueOnce(tgtSlots);
      const preview = await slotService.previewWeeklyCopy(mockStaff, {
        sourceWeekStart: '2026-08-17',
        targetWeekStart: '2026-08-24',
      });
      expect(preview.sourceCount).toBe(1);
      expect(preview.targetCount).toBe(1);
      expect(preview.sourceDays).toBe(1);

      slotDao.listByDateRange.mockResolvedValueOnce(srcSlots).mockResolvedValueOnce(tgtSlots);
      await expect(
        slotService.copyWeeklySchedule(mockStaff, {
          sourceWeekStart: '2026-08-17',
          targetWeekStart: '2026-08-24',
          expectedSourceSlotIds: [999],
        })
      ).rejects.toMatchObject({ code: 'WEEKLY_COPY_CHANGED' });

      slotDao.listByDateRange.mockResolvedValueOnce(srcSlots).mockResolvedValueOnce(tgtSlots);
      await expect(
        slotService.copyWeeklySchedule(mockStaff, {
          sourceWeekStart: '2026-08-17',
          targetWeekStart: '2026-08-24',
          expectedTargetSlotIds: [],
        })
      ).rejects.toMatchObject({ code: 'WEEKLY_COPY_CHANGED' });

      slotDao.listByDateRange.mockResolvedValueOnce(srcSlots).mockResolvedValueOnce(tgtSlots);
      const copied = await slotService.copyWeeklySchedule(mockStaff, {
        sourceWeekStart: '2026-08-17',
        targetWeekStart: '2026-08-24',
        expectedRevision: preview.revision,
        expectedSourceSlotIds: [10],
        expectedTargetSlotIds: [20],
      });
      expect(copied).toEqual({ targetWeekStart: '2026-08-24', copiedCount: 1 });
      expect(slotDao.addTableToSlot).toHaveBeenCalledWith(slotDao, 30, 1, 4);
    });
  });
});