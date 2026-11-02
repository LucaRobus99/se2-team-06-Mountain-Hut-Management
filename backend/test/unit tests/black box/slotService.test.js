import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSlotService } from '../../../src/services/slotService.js';
import { ValidationError, NotFoundError, ConflictError, UnprocessableEntityError } from '../../../src/errors/AppError.js';

describe('slotService - Black-Box Tests', () => {
 let slotDao;
  let hutDao;
  let slotService;
  const timeZone = 'Europe/Rome';
  const fixedNow = new Date('2026-08-14T07:00:00.000Z');

  beforeEach(() => {
    // Reset mocks before each test
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

  describe('listAvailableSlots', () => {
    
    it('should throw a ValidationError if required query parameters are missing', async () => {
      hutDao.findById.mockResolvedValue({ id: 1, name: 'Mountain Hut' });

      // Missing meal and partySize
      await expect(
        slotService.listAvailableSlots(1, { date: '2026-08-14' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw a NotFoundError if the hut does not exist', async () => {
      hutDao.findById.mockResolvedValue(null);

      await expect(
        slotService.listAvailableSlots(999, { date: '2026-08-14', meal: 'lunch', partySize: '2' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should return filtered and sorted available slots successfully', async () => {
      hutDao.findById.mockResolvedValue({ id: 1, name: 'Mountain Hut' });
      
      slotDao.listByDate.mockResolvedValue([
        { id: 101, hut_id: 1, date: '2026-08-14', start_time: '14:00', meal: 'lunch', status: 'available' },
        { id: 102, hut_id: 1, date: '2026-08-14', start_time: '12:00', meal: 'lunch', status: 'available' },
        { id: 103, hut_id: 1, date: '2026-08-14', start_time: '12:00', meal: 'dinner', status: 'available' },
      ]);

      // Make sure getTablesWithFreeForSlot returns valid tables for BOTH slot 101 and slot 102
      slotDao.getTablesWithFreeForSlot.mockImplementation(async (slotId) => {
        if (slotId === 101 || slotId === 102) {
          return [{ id: 1, label: 'T1', seats: 4, free: 4 }];
        }
        return [];
      });

      const result = await slotService.listAvailableSlots(1, {
        date: '2026-08-14',
        meal: 'lunch',
        partySize: '2',
      });

      expect(result).toEqual({
        hutId: 1,
        date: '2026-08-14',
        meal: 'lunch',
        partySize: 2,
        slots: [
          {
            id: 102,
            startTime: '12:00',
            availableSeats: 4,
            tables: [{ tableId: 1, tableLabel: 'T1', seats: 4, freeSeats: 4 }],
          },
          {
            id: 101,
            startTime: '14:00',
            availableSeats: 4,
            tables: [{ tableId: 1, tableLabel: 'T1', seats: 4, freeSeats: 4 }],
          },
        ],
      });
    });

  });

  describe('getSeating', () => {

    it('should throw a ValidationError if partySize is invalid', async () => {
      hutDao.findById.mockResolvedValue({ id: 1 });

      await expect(
        slotService.getSeating(1, 101, { partySize: 'invalid' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw a NotFoundError if the slot does not belong to the hut', async () => {
      hutDao.findById.mockResolvedValue({ id: 1 });
      slotDao.findById.mockResolvedValue({ id: 101, hut_id: 2 }); // Mismatched hut_id

      await expect(
        slotService.getSeating(1, 101, { partySize: '2' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw a ConflictError if the slot is not available', async () => {
      hutDao.findById.mockResolvedValue({ id: 1 });
      slotDao.findById.mockResolvedValue({ id: 101, hut_id: 1, status: 'booked', start_time: '14:00', date: '2026-08-14' });

      await expect(
        slotService.getSeating(1, 101, { partySize: '2' })
      ).rejects.toThrow(ConflictError);
    });

    it('should throw an UnprocessableEntityError if the slot is too late to book', async () => {
      hutDao.findById.mockResolvedValue({ id: 1 });
      // Slot starting very soon (e.g., 30 minutes from fixedNow)
      slotDao.findById.mockResolvedValue({ id: 101, hut_id: 1, status: 'available', start_time: '10:30', date: '2026-08-14' });

      await expect(
        slotService.getSeating(1, 101, { partySize: '2' })
      ).rejects.toThrow(UnprocessableEntityError);
    });

  });

});