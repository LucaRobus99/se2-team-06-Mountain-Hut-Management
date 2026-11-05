import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSlotService } from '../../../../src/services/slotService.js';
import { ValidationError, ForbiddenError } from '../../../../src/errors/AppError.js';

describe('slotService - White-Box Tests', () => {
  let slotDao;
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
      getTablesWithFreeForSlot: vi.fn(),
      getTablesWithFreeForSlots: vi.fn(),
      findById: vi.fn(),
      findMealAt: vi.fn(),
      createSlot: vi.fn(),
      addTableToSlot: vi.fn(),
      findTableByLabel: vi.fn(),
      createTable: vi.fn(),
      getTableSetForSlot: vi.fn(),
    };

    slotService = createSlotService({
      slotDao,
      timeZone,
      now: () => fixedNow,
    });
  });

  describe('Internal Query Validation Branches (validateSlotsQuery)', () => {
    
    it('should trigger validateDate internal checks and fail for non-existent calendar dates (e.g., February 31st)', async () => {
      try {
        await slotService.listAvailableSlots({
          date: '2026-02-31', // Invalid calendar day
          meal: 'lunch',
          partySize: '2',
        });
        expect.fail('Should have thrown a ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'date', rule: 'invalid' })
          ])
        );
      }
    });

    it('should validate partySize robustly handling various formats through validatePartySize branch', async () => {
      try {
        await slotService.listAvailableSlots({
          date: '2026-08-14',
          meal: 'lunch',
          partySize: '0', // Invalid positive int
        });
        expect.fail('Should have thrown a ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'partySize', rule: 'invalid' })
          ])
        );
      }
    });

    it('should validate meal format against allowed meals', async () => {
      try {
        await slotService.listAvailableSlots({
          date: '2026-08-14',
          meal: 'brunch', // Not allowed meal type
          partySize: '2',
        });
        expect.fail('Should have thrown a ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'meal' })
          ])
        );
      }
    });

  });

  describe('Internal Seating Query Validation Branches (validateSeatingQuery)', () => {
    
    it('should throw ValidationError if partySize is completely missing in seating query', async () => {
      slotDao.findById.mockResolvedValue({ id: 101, status: 'available' });

      try {
        await slotService.getSeating(101, {}); // Missing partySize
        expect.fail('Should have thrown a ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'partySize', rule: 'required' })
          ])
        );
      }
    });

  });

  describe('Staff Authentication and Authorization (assertStaff)', () => {

    it('should throw ForbiddenError when a non-staff user attempts to execute staff-only operations', async () => {
      await expect(
        slotService.getSlot(mockHiker, 101)
      ).rejects.toThrow(ForbiddenError);
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
          endTime: '12:00', // Before start time
          tables: [{ tableIdentifier: 'T1', seats: 4 }]
        });
        expect.fail('Should have thrown ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'endTime' })
          ])
        );
      }
    });

  });

});