import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSlotService } from '../../../src/services/slotService.js';
import { ValidationError, NotFoundError, ConflictError, UnprocessableEntityError } from '../../../src/errors/AppError.js';

describe('slotService - Black-Box Tests', () => {
  let slotDao;
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
    // Reset mocks before each test
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

  describe('listAvailableSlots', () => {
    
    it('should throw a ValidationError if required query parameters are missing', async () => {
      // Missing meal and partySize
      await expect(
        slotService.listAvailableSlots({ date: '2026-08-14' })
      ).rejects.toThrow(ValidationError);
    });

    it('should return filtered and sorted available slots successfully', async () => {
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
            availableSeats: 4,
            tables: [{ tableId: 1, tableLabel: 'T1', seats: 4, freeSeats: 4 }],
          },
          {
            id: 101,
            startTime: '14:00',
            endTime: '15:00',
            availableSeats: 4,
            tables: [{ tableId: 1, tableLabel: 'T1', seats: 4, freeSeats: 4 }],
          },
        ],
      });
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
      slotDao.findById.mockResolvedValue({ id: 101, status: 'booked', start_time: '14:00', date: '2026-08-14' });

      await expect(
        slotService.getSeating(101, { partySize: '2' })
      ).rejects.toThrow(ConflictError);
    });

    it('should throw an UnprocessableEntityError if the slot is too late to book', async () => {
      slotDao.findById.mockResolvedValue({ id: 101, status: 'available', start_time: '10:30', date: '2026-08-14' });

      await expect(
        slotService.getSeating(101, { partySize: '2' })
      ).rejects.toThrow(UnprocessableEntityError);
    });

  });

  describe('Staff Slot Management (getSlot, listSlots, createSlot)', () => {

    it('should throw ForbiddenError if a non-staff user tries to retrieve a slot', async () => {
      await expect(
        slotService.getSlot(mockHiker, 101)
      ).rejects.toThrow();
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
        { id: 1, label: 'T1', seats: 4, free: 4 }
      ]);

      const result = await slotService.getSlot(mockStaff, 101);
      expect(result.id).toBe(101);
      expect(result.tables.length).toBe(1);
    });

    it('should successfully create a new slot when valid body and staff user are provided', async () => {
      slotDao.findMealAt.mockResolvedValue({
        meal_type: 'lunch',
        start_time: '12:00',
        end_time: '15:00',
      });
      slotDao.listByDate.mockResolvedValue([]); // No overlaps
      slotDao.createSlot.mockResolvedValue(105);
      slotDao.findTableByLabel.mockResolvedValue({ id: 1 });
      slotDao.addTableToSlot.mockResolvedValue();
      
      // Mock for getSlot called at the end of createSlot
      slotDao.findById.mockResolvedValue({
        id: 105,
        date: '2026-08-14',
        start_time: '12:30',
        end_time: '13:30',
        status: 'available',
        meal: 'lunch',
      });
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 }
      ]);

      const result = await slotService.createSlot(mockStaff, {
        date: '2026-08-14',
        startTime: '12:30',
        endTime: '13:30',
        tables: [{ tableIdentifier: 'T1', seats: 4 }]
      });

      expect(result.id).toBe(105);
      expect(slotDao.createSlot).toHaveBeenCalled();
    });

  });

});