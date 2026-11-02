import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSlotService } from '../../../src/services/slotService.js';
import { ValidationError } from '../../../src/errors/AppError.js';

describe('slotService - White-Box Tests', () => {
  let slotDao;
  let hutDao;
  let slotService;
  const timeZone = 'Europe/Rome';
  const fixedNow = new Date('2026-08-14T07:00:00.000Z'); // 09:00 local time

  beforeEach(() => {
    slotDao = {
      listByDate: vi.fn(),
      getTablesWithFreeForSlot: vi.fn(),
      findById: vi.fn(),
    };
    hutDao = {
      findById: vi.fn(),
    };

    slotService = createSlotService({
      slotDao,
      hutDao,
      timeZone,
      now: () => fixedNow,
    });
  });

  describe('Internal Query Validation Branches (validateSlotsQuery)', () => {
    
    it('should catch unknown/unallowed fields in query parameters and add them to validation error details', async () => {
      hutDao.findById.mockResolvedValue({ id: 1, name: 'Mountain Hut' });

      try {
        await slotService.listAvailableSlots(1, {
          date: '2026-08-14',
          meal: 'lunch',
          partySize: '2',
          extraField: 'notAllowedValue', // Branch for unknown keys
        });
        expect.fail('Should have thrown a ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'extraField', rule: 'unknown' })
          ])
        );
      }
    });

    it('should trigger validateDate internal checks and fail for non-existent calendar dates (e.g., February 31st)', async () => {
      hutDao.findById.mockResolvedValue({ id: 1, name: 'Mountain Hut' });

      try {
        await slotService.listAvailableSlots(1, {
          date: '2026-02-31', // Invalid calendar day caught by Date.UTC comparison
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
      hutDao.findById.mockResolvedValue({ id: 1, name: 'Mountain Hut' });

      // Testing negative or zero partySize string
      try {
        await slotService.listAvailableSlots(1, {
          date: '2026-08-14',
          meal: 'lunch',
          partySize: '0',
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

  });

  describe('Internal Seating Query Validation Branches (validateSeatingQuery)', () => {
    
    it('should throw ValidationError if partySize is completely missing in seating query', async () => {
      hutDao.findById.mockResolvedValue({ id: 1 });
      slotDao.findById.mockResolvedValue({ id: 101, hut_id: 1, status: 'available' });

      try {
        await slotService.getSeating(1, 101, {}); // Missing partySize
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

    it('should detect unallowed query parameters in validateSeatingQuery branch', async () => {
      hutDao.findById.mockResolvedValue({ id: 1 });
      slotDao.findById.mockResolvedValue({ id: 101, hut_id: 1, status: 'available' });

      try {
        await slotService.getSeating(1, 101, { partySize: '2', invalidParam: 'test' });
        expect.fail('Should have thrown a ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'invalidParam', rule: 'unknown' })
          ])
        );
      }
    });

  });

});