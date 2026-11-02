import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBookingService } from '../../../src/services/bookingService.js';
import { 
  UnauthorizedError, 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  UnprocessableEntityError 
} from '../../../src/errors/AppError.js';

describe('bookingService - Black-Box Tests', () => {
  let db;
  let bookingDao;
  let slotDao;
  let bookingService;
  const timeZone = 'Europe/Rome';
  const fixedNow = new Date('2026-08-14T07:00:00.000Z'); // 09:00 local time

  const mockHiker = {
    id: 10,
    displayName: 'Mario Rossi',
    email: 'mario.rossi@example.com',
    phone: '+393331234567',
    role: 'hiker',
  };

  beforeEach(() => {
    // Mock database transaction wrapper
    db = {
      transaction: vi.fn(async (callback) => callback('mock-tx')),
    };

    bookingDao = {
      findConfirmedByHikerAndSlot: vi.fn(),
      create: vi.fn(),
      insertSeats: vi.fn(),
      findById: vi.fn(),
      getSeatAssignments: vi.fn(),
    };

    slotDao = {
      findById: vi.fn(),
      getTablesWithFreeForSlot: vi.fn(),
    };

    bookingService = createBookingService({
      db,
      bookingDao,
      slotDao,
      timeZone,
      now: () => fixedNow,
    });
  });

  describe('createBooking', () => {

    it('should throw an UnauthorizedError if hiker is missing or unauthenticated', async () => {
      await expect(
        bookingService.createBooking(null, { slotId: 101, partySize: 2 })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw a ValidationError if required body fields (slotId or partySize) are missing', async () => {
      await expect(
        bookingService.createBooking(mockHiker, { partySize: 2 }) // Missing slotId
      ).rejects.toThrow(ValidationError);
    });

    it('should throw a NotFoundError if the slot does not exist', async () => {
      slotDao.findById.mockResolvedValue(null);

      await expect(
        bookingService.createBooking(mockHiker, { slotId: 999, partySize: 2 })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw a ConflictError if the slot is not available', async () => {
      slotDao.findById.mockResolvedValue({ 
        id: 101, 
        status: 'booked', // Not available
        start_time: '14:00', 
        date: '2026-08-14' 
      });

      await expect(
        bookingService.createBooking(mockHiker, { slotId: 101, partySize: 2 })
      ).rejects.toThrow(ConflictError);
    });

    it('should throw an UnprocessableEntityError if booking is too late (less than 2h before start)', async () => {
      slotDao.findById.mockResolvedValue({ 
        id: 101, 
        status: 'available', 
        start_time: '10:30', // fixedNow is 09:00, only 1.5 hours left
        date: '2026-08-14' 
      });

      await expect(
        bookingService.createBooking(mockHiker, { slotId: 101, partySize: 2 })
      ).rejects.toThrow(UnprocessableEntityError);
    });

    it('should throw a ConflictError if the hiker already has a confirmed booking for this slot', async () => {
      slotDao.findById.mockResolvedValue({ 
        id: 101, 
        status: 'available', 
        start_time: '14:00', 
        date: '2026-08-14' 
      });
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue({ id: 50 }); // Already booked

      await expect(
        bookingService.createBooking(mockHiker, { slotId: 101, partySize: 2 })
      ).rejects.toThrow(ConflictError);
    });

    it('should successfully create a booking when all conditions and seating fit are met', async () => {
      slotDao.findById.mockResolvedValue({ 
        id: 101, 
        status: 'available', 
        start_time: '14:00', 
        end_time: '16:00',
        date: '2026-08-14',
        meal: 'lunch'
      });
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue(null);
      
      // Free table available
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 }
      ]);

      bookingDao.create.mockResolvedValue(100); // New booking ID
      bookingDao.findById.mockResolvedValue({
        id: 100,
        status: 'confirmed',
        hiker_id: 10,
        created_by: null,
        slot_id: 101,
        slot_date: '2026-08-14',
        slot_start_time: '14:00',
        slot_end_time: '16:00',
        meal: 'lunch',
        party_size: 2,
        contact_name: 'Mario Rossi',
        email: 'mario.rossi@example.com',
        phone: '+393331234567',
        created_at: '2026-08-14T07:05:00.000Z',
      });
      bookingDao.getSeatAssignments.mockResolvedValue([
        { tableId: 1, tableLabel: 'T1', seats: 2 }
      ]);

      const result = await bookingService.createBooking(mockHiker, {
        slotId: 101,
        partySize: 2,
      });

      expect(result).toEqual({
        id: 100,
        status: 'confirmed',
        hikerId: 10,
        createdBy: null,
        slot: {
          id: 101,
          date: '2026-08-14',
          startTime: '14:00',
          endTime: '16:00',
          meal: 'lunch',
        },
        partySize: 2,
        contactName: 'Mario Rossi',
        email: 'mario.rossi@example.com',
        contactNumber: '+393331234567',
        split: false,
        seatAssignments: [
          { tableId: 1, tableLabel: 'T1', seats: 2 }
        ],
        createdAt: '2026-08-14T07:05:00.000Z',
      });
      expect(bookingDao.insertSeats).toHaveBeenCalled();
    });

  });

  describe('getBooking', () => {

    it('should throw a NotFoundError if booking ID is invalid', async () => {
      await expect(
        bookingService.getBooking('invalid-id', mockHiker)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw a NotFoundError if booking does not exist', async () => {
      bookingDao.findById.mockResolvedValue(null);

      await expect(
        bookingService.getBooking(100, mockHiker)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw a NotFoundError if a hiker tries to access another hiker\'s booking', async () => {
      bookingDao.findById.mockResolvedValue({
        id: 100,
        hiker_id: 99, // Different hiker ID
      });

      await expect(
        bookingService.getBooking(100, mockHiker)
      ).rejects.toThrow(NotFoundError);
    });

    it('should successfully return booking details for the authorized hiker', async () => {
      bookingDao.findById.mockResolvedValue({
        id: 100,
        status: 'confirmed',
        hiker_id: 10, // Matches mockHiker.id
        created_by: null,
        slot_id: 101,
        slot_date: '2026-08-14',
        slot_start_time: '14:00',
        slot_end_time: '16:00',
        meal: 'lunch',
        party_size: 2,
        contact_name: 'Mario Rossi',
        email: 'mario.rossi@example.com',
        phone: '+393331234567',
        created_at: '2026-08-14T07:05:00.000Data.000Z',
      });
      bookingDao.getSeatAssignments.mockResolvedValue([
        { tableId: 1, tableLabel: 'T1', seats: 2 }
      ]);

      const result = await bookingService.getBooking(100, mockHiker);

      expect(result.id).toBe(100);
      expect(result.partySize).toBe(2);
      expect(result.seatAssignments).toEqual([
        { tableId: 1, tableLabel: 'T1', seats: 2 }
      ]);
    });

  });

});