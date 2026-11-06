import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBookingService } from '../../../../src/services/bookingService.js';
import { 
  UnauthorizedError, 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  UnprocessableEntityError 
} from '../../../../src/errors/AppError.js';

// Mock isStaff to ensure staff roles are correctly recognized in tests
vi.mock('../../../../src/auth/roles.js', () => ({
  isStaff: vi.fn((user) => user?.role === 'staff' || user?.id === 1),
}));

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

  const mockStaff = {
    id: 1,
    displayName: 'Staff Admin',
    email: 'staff@hut.com',
    role: 'staff',
  };

  beforeEach(() => {
    vi.clearAllMocks();

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

    it('should throw a ValidationError if a hiker sends unauthorized contact fields', async () => {
      slotDao.findById.mockResolvedValue({ 
        id: 101, 
        status: 'available', 
        start_time: '14:00', 
        date: '2026-08-14' 
      });

      await expect(
        bookingService.createBooking(mockHiker, { 
          slotId: 101, 
          partySize: 2, 
          contactName: 'Not Allowed' 
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw a ValidationError if staff provides no contact details', async () => {
      slotDao.findById.mockResolvedValue({ 
        id: 101, 
        status: 'available', 
        start_time: '14:00', 
        date: '2026-08-14' 
      });

      await expect(
        bookingService.createBooking(mockStaff, { 
          slotId: 101, 
          partySize: 2 
          // Missing contactName, email, and contactNumber
        })
      ).rejects.toThrow(ValidationError);
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
      
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 }
      ]);

      bookingDao.create.mockResolvedValue(100);
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
        confirmationEmail: { status: 'skipped' },
      });
      expect(bookingDao.insertSeats).toHaveBeenCalled();
    });

    it('should successfully handle group split across multiple tables with a notice', async () => {
      slotDao.findById.mockResolvedValue({ 
        id: 101, 
        status: 'available', 
        start_time: '14:00', 
        end_time: '16:00',
        date: '2026-08-14',
        meal: 'lunch'
      });
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue(null);
      
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 2, free: 2 },
        { id: 2, label: 'T2', seats: 2, free: 2 }
      ]);

      bookingDao.create.mockResolvedValue(101);
      bookingDao.findById.mockResolvedValue({
        id: 101,
        status: 'confirmed',
        hiker_id: 10,
        created_by: null,
        slot_id: 101,
        slot_date: '2026-08-14',
        slot_start_time: '14:00',
        slot_end_time: '16:00',
        meal: 'lunch',
        party_size: 4,
        contact_name: 'Mario Rossi',
        email: 'mario.rossi@example.com',
        phone: '+393331234567',
        created_at: '2026-08-14T07:05:00.000Z',
      });
      bookingDao.getSeatAssignments.mockResolvedValue([
        { tableId: 1, tableLabel: 'T1', seats: 2 },
        { tableId: 2, tableLabel: 'T2', seats: 2 }
      ]);

      const result = await bookingService.createBooking(mockHiker, {
        slotId: 101,
        partySize: 4,
      });

      expect(result.split).toBe(true);
      expect(result.notice).toEqual({
        code: 'GROUP_SPLIT',
        message: 'The group will be seated across multiple tables.',
      });
    });

    it('should succeed even if email notification service throws an error', async () => {
      const failingNotifier = {
        send: vi.fn().mockRejectedValue(new Error('SMTP Down')),
      };

      const serviceWithEmail = createBookingService({
        db,
        bookingDao,
        slotDao,
        timeZone,
        now: () => fixedNow,
        emailService: failingNotifier,
      });

      slotDao.findById.mockResolvedValue({ 
        id: 101, status: 'available', start_time: '14:00', end_time: '16:00', date: '2026-08-14', meal: 'lunch' 
      });
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue(null);
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([{ id: 1, label: 'T1', seats: 4, free: 4 }]);
      bookingDao.create.mockResolvedValue(100);
      bookingDao.findById.mockResolvedValue({
        id: 100, status: 'confirmed', hiker_id: 10, slot_id: 101, slot_date: '2026-08-14',
        slot_start_time: '14:00', slot_end_time: '16:00', meal: 'lunch', party_size: 2,
        contact_name: 'Mario', email: 'm@example.com', phone: '123', created_at: '2026-08-14T07:05:00.000Z'
      });
      bookingDao.getSeatAssignments.mockResolvedValue([{ tableId: 1, tableLabel: 'T1', seats: 2 }]);

      const result = await serviceWithEmail.createBooking(mockHiker, { slotId: 101, partySize: 2 });
      expect(result.id).toBe(100);
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
        hiker_id: 99,
      });

      await expect(
        bookingService.getBooking(100, mockHiker)
      ).rejects.toThrow(NotFoundError);
    });

    it('should allow staff to read any booking regardless of hiker_id', async () => {
      bookingDao.findById.mockResolvedValue({
        id: 100,
        status: 'confirmed',
        hiker_id: 99,
        created_by: 1,
        slot_id: 101,
        slot_date: '2026-08-14',
        slot_start_time: '14:00',
        slot_end_time: '16:00',
        meal: 'lunch',
        party_size: 2,
        contact_name: 'Guest Guest',
        email: 'guest@example.com',
        phone: '987654321',
        created_at: '2026-08-14T07:05:00.000Z',
      });
      bookingDao.getSeatAssignments.mockResolvedValue([
        { tableId: 1, tableLabel: 'T1', seats: 2 }
      ]);

      const result = await bookingService.getBooking(100, mockStaff);

      expect(result.id).toBe(100);
      expect(result.hikerId).toBe(99);
    });

    it('should successfully return booking details for the authorized hiker', async () => {
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

      const result = await bookingService.getBooking(100, mockHiker);

      expect(result.id).toBe(100);
      expect(result.partySize).toBe(2);
      expect(result.seatAssignments).toEqual([
        { tableId: 1, tableLabel: 'T1', seats: 2 }
      ]);
    });

  });

});