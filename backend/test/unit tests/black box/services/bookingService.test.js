import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBookingService } from '../../../../src/services/bookingService.js';
import {
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
  AppError,
} from '../../../../src/errors/AppError.js';

vi.mock('../../../../src/auth/roles.js', async (importOriginal) => ({
  ...(await importOriginal()),
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

    db = {
      transaction: vi.fn(async (callback) => callback('mock-tx')),
    };

    bookingDao = {
      findConfirmedByHikerAndSlot: vi.fn(),
      create: vi.fn(),
      insertSeats: vi.fn(),
      findById: vi.fn(),
      getSeatAssignments: vi.fn(),
      insertRequirements: vi.fn(),
      replaceRequirements: vi.fn(),
      getRequirements: vi.fn().mockResolvedValue([]),
      getRequirementsByBookingIds: vi.fn().mockResolvedValue(new Map()),
      listByHiker: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      deleteSeats: vi.fn(),
      cancelIfConfirmed: vi.fn(),
    };

    slotDao = {
      findById: vi.fn(),
      listByDate: vi.fn(),
      getTablesWithFreeForSlot: vi.fn(),
      getTablesWithFreeForSlots: vi.fn(),
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
        bookingService.createBooking(mockHiker, { partySize: 2 })
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
        status: 'booked',
        start_time: '14:00',
        date: '2026-08-14',
      });

      await expect(
        bookingService.createBooking(mockHiker, { slotId: 101, partySize: 2 })
      ).rejects.toThrow(ConflictError);
    });

    it('should throw an UnprocessableEntityError if booking is too late (less than 2h before start)', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        start_time: '10:30',
        date: '2026-08-14',
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
        date: '2026-08-14',
      });
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue({ id: 50 });

      await expect(
        bookingService.createBooking(mockHiker, { slotId: 101, partySize: 2 })
      ).rejects.toThrow(ConflictError);
    });

    it('should throw a ConflictError when available seats are insufficient for partySize', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        start_time: '14:00',
        date: '2026-08-14',
      });
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue(null);
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 2, free: 1 },
      ]);

      await expect(
        bookingService.createBooking(mockHiker, { slotId: 101, partySize: 2 })
      ).rejects.toMatchObject({ status: 409, code: 'INSUFFICIENT_CAPACITY' });
    });

    it('should throw a ValidationError if a hiker sends unauthorized contact fields', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        start_time: '14:00',
        date: '2026-08-14',
      });

      await expect(
        bookingService.createBooking(mockHiker, {
          slotId: 101,
          partySize: 2,
          contactName: 'Not Allowed',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should refuse staff with FORBIDDEN: staff book through createStaffBooking (MH-07)', async () => {
      await expect(
        bookingService.createBooking(mockStaff, {
          slotId: 101,
          partySize: 2,
          contactName: 'Walk-in guest',
        })
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('should successfully create a booking when all conditions and seating fit are met', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        start_time: '14:00',
        end_time: '16:00',
        date: '2026-08-14',
        meal: 'lunch',
      });
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue(null);
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 },
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
        { tableId: 1, tableLabel: 'T1', seats: 2 },
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
        requirements: [],
        split: false,
        seatAssignments: [{ tableId: 1, tableLabel: 'T1', seats: 2 }],
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
        meal: 'lunch',
      });
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue(null);
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 2, free: 2 },
        { id: 2, label: 'T2', seats: 2, free: 2 },
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
        { tableId: 2, tableLabel: 'T2', seats: 2 },
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
        sendBookingEmail: vi.fn().mockRejectedValue(new Error('SMTP Down')),
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
        id: 101,
        status: 'available',
        start_time: '14:00',
        end_time: '16:00',
        date: '2026-08-14',
        meal: 'lunch',
      });
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue(null);
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 },
      ]);
      bookingDao.create.mockResolvedValue(100);
      bookingDao.findById.mockResolvedValue({
        id: 100,
        status: 'confirmed',
        hiker_id: 10,
        slot_id: 101,
        slot_date: '2026-08-14',
        slot_start_time: '14:00',
        slot_end_time: '16:00',
        meal: 'lunch',
        party_size: 2,
        contact_name: 'Mario',
        email: 'm@example.com',
        phone: '123',
        created_at: '2026-08-14T07:05:00.000Z',
      });
      bookingDao.getSeatAssignments.mockResolvedValue([
        { tableId: 1, tableLabel: 'T1', seats: 2 },
      ]);

      const result = await serviceWithEmail.createBooking(mockHiker, {
        slotId: 101,
        partySize: 2,
      });
      expect(result.id).toBe(100);
    });

    it('should throw a ValidationError if party requirements contain a non-boolean allergy flag', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        start_time: '14:00',
        date: '2026-08-14',
      });

      await expect(
        bookingService.createBooking(mockHiker, {
          slotId: 101,
          partySize: 2,
          requirements: [{ description: 'Vegan', allergies: 'yes' }],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should successfully create a booking including party requirements', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        start_time: '14:00',
        end_time: '16:00',
        date: '2026-08-14',
        meal: 'lunch',
      });
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue(null);
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 },
      ]);
      bookingDao.insertRequirements.mockResolvedValue(true);
      bookingDao.getRequirements.mockResolvedValue([
        { description: 'Peanut allergy', allergies: true },
      ]);
      bookingDao.create.mockResolvedValue(105);
      bookingDao.findById.mockResolvedValue({
        id: 105,
        status: 'confirmed',
        hiker_id: 10,
        slot_id: 101,
        slot_date: '2026-08-14',
        slot_start_time: '14:00',
        slot_end_time: '16:00',
        meal: 'lunch',
        party_size: 2,
        contact_name: 'Mario',
        email: 'm@example.com',
        phone: '123',
        created_at: '2026-08-14T07:05:00.000Z',
      });
      bookingDao.getSeatAssignments.mockResolvedValue([
        { tableId: 1, tableLabel: 'T1', seats: 2 },
      ]);

      const result = await bookingService.createBooking(mockHiker, {
        slotId: 101,
        partySize: 2,
        requirements: [{ description: 'Peanut allergy', allergies: true }],
      });

      expect(bookingDao.insertRequirements).toHaveBeenCalled();
      expect(result.requirements).toEqual([{ description: 'Peanut allergy', allergies: true }]);
    });
  });

  describe('getBooking', () => {
    it('should throw a NotFoundError if booking ID is invalid', async () => {
      await expect(bookingService.getBooking('invalid-id', mockHiker)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw a NotFoundError if booking does not exist', async () => {
      bookingDao.findById.mockResolvedValue(null);

      await expect(bookingService.getBooking(100, mockHiker)).rejects.toThrow(NotFoundError);
    });

    it("should throw a NotFoundError if a hiker tries to access another hiker's booking", async () => {
      bookingDao.findById.mockResolvedValue({
        id: 100,
        hiker_id: 99,
      });

      await expect(bookingService.getBooking(100, mockHiker)).rejects.toThrow(NotFoundError);
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
        { tableId: 1, tableLabel: 'T1', seats: 2 },
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
        { tableId: 1, tableLabel: 'T1', seats: 2 },
      ]);

      const result = await bookingService.getBooking(100, mockHiker);

      expect(result.id).toBe(100);
      expect(result.partySize).toBe(2);
      expect(result.seatAssignments).toEqual([{ tableId: 1, tableLabel: 'T1', seats: 2 }]);
    });
  });

  describe('listModificationSlots (MH-06)', () => {
    it('should throw UnauthorizedError if user is unauthenticated', async () => {
      await expect(
        bookingService.listModificationSlots(null, 100, {
          date: '2026-08-16',
          meal: 'lunch',
          partySize: 2,
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw ValidationError if query parameters are missing or invalid', async () => {
      await expect(
        bookingService.listModificationSlots(mockHiker, 100, {})
      ).rejects.toThrow(ValidationError);
    });

    it('should reject modifications within 48 hours of original slot start', async () => {
      bookingDao.findById.mockResolvedValue({
        id: 100,
        status: 'confirmed',
        hiker_id: 10,
        slot_id: 101,
        party_size: 2,
      });
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        date: '2026-08-15',
        start_time: '12:00',
      });

      await expect(
        bookingService.listModificationSlots(mockHiker, 100, {
          date: '2026-08-16',
          meal: 'lunch',
          partySize: 2,
        })
      ).rejects.toMatchObject({ status: 409, code: 'TOO_LATE_TO_MODIFY' });
    });

    it('should return eligible slots with freeSeats and seat counts without exposing table IDs', async () => {
      bookingDao.findById.mockResolvedValue({
        id: 100,
        status: 'confirmed',
        hiker_id: 10,
        slot_id: 101,
        party_size: 2,
      });
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        date: '2026-08-17',
        start_time: '12:00',
      });
      slotDao.listByDate.mockResolvedValue([
        {
          id: 201,
          status: 'available',
          meal: 'lunch',
          date: '2026-08-17',
          start_time: '12:00',
          end_time: '14:00',
        },
        {
          id: 202,
          status: 'available',
          meal: 'dinner',
          date: '2026-08-17',
          start_time: '19:00',
          end_time: '21:00',
        },
      ]);
      slotDao.getTablesWithFreeForSlots.mockResolvedValue([
        { slot_id: 201, id: 5, label: 'Secret-Table', seats: 4, free: 4 },
      ]);
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue(null);

      const res = await bookingService.listModificationSlots(mockHiker, 100, {
        date: '2026-08-17',
        meal: 'lunch',
        partySize: 2,
      });

      expect(res).toEqual({
        date: '2026-08-17',
        meal: 'lunch',
        partySize: 2,
        slots: [
          {
            id: 201,
            startTime: '12:00',
            endTime: '14:00',
            meal: 'lunch',
            fit: 'single_table',
            tables: [{ freeSeats: 4 }],
            seatAssignments: [{ seats: 2 }],
          },
        ],
      });
      expect(res.slots[0].tables[0]).not.toHaveProperty('id');
      expect(res.slots[0].tables[0]).not.toHaveProperty('label');
    });
  });

  describe('updateBooking', () => {
    it('should throw an UnauthorizedError if user is not authenticated', async () => {
      await expect(
        bookingService.updateBooking(null, 100, { partySize: 3 })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw a NotFoundError if booking ID format is invalid', async () => {
      await expect(
        bookingService.updateBooking(mockHiker, 'invalid', { partySize: 3 })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw a ValidationError if update body is empty or invalid', async () => {
      bookingDao.findById.mockResolvedValue({
        id: 100,
        status: 'confirmed',
        hiker_id: 10,
        slot_id: 101,
      });
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        date: '2026-08-16',
        start_time: '14:00',
      });

      await expect(bookingService.updateBooking(mockHiker, 100, {})).rejects.toThrow(
        ValidationError
      );
    });

    it('should reject updating a cancelled booking', async () => {
      bookingDao.findById.mockResolvedValue({
        id: 100,
        status: 'cancelled',
        hiker_id: 10,
        slot_id: 101,
      });

      await expect(
        bookingService.updateBooking(mockHiker, 100, { partySize: 3 })
      ).rejects.toMatchObject({ status: 409, code: 'BOOKING_NOT_CONFIRMED' });
    });

    it('should reject moving to a target slot where hiker already has another confirmed booking', async () => {
      bookingDao.findById.mockResolvedValue({
        id: 100,
        status: 'confirmed',
        hiker_id: 10,
        slot_id: 101,
        party_size: 2,
      });
      slotDao.findById
        .mockResolvedValueOnce({
          id: 101,
          status: 'available',
          date: '2026-08-17',
          start_time: '12:00',
        })
        .mockResolvedValueOnce({
          id: 102,
          status: 'available',
          date: '2026-08-17',
          start_time: '19:00',
        });
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue({ id: 250 });

      await expect(
        bookingService.updateBooking(mockHiker, 100, { slotId: 102 })
      ).rejects.toMatchObject({ status: 409, code: 'BOOKING_ALREADY_EXISTS' });
    });

    it('should reject when expectedSeating is single_table but seating requires a split', async () => {
      bookingDao.findById.mockResolvedValue({
        id: 100,
        status: 'confirmed',
        hiker_id: 10,
        slot_id: 101,
        party_size: 2,
      });
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        date: '2026-08-17',
        start_time: '12:00',
      });
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 2, free: 2 },
        { id: 2, label: 'T2', seats: 2, free: 2 },
      ]);

      await expect(
        bookingService.updateBooking(mockHiker, 100, {
          partySize: 4,
          expectedSeating: 'single_table',
        })
      ).rejects.toMatchObject({ status: 409, code: 'SEATING_CHANGED' });
    });

    it('should successfully update a booking when valid parameters are provided', async () => {
      bookingDao.findById
        .mockResolvedValueOnce({
          id: 100,
          status: 'confirmed',
          hiker_id: 10,
          slot_id: 101,
          party_size: 2,
          slot_date: '2026-08-16',
          slot_start_time: '14:00',
          slot_end_time: '16:00',
          meal: 'lunch',
          contact_name: 'Mario Rossi',
          email: 'mario.rossi@example.com',
          phone: '123',
          created_at: '2026-08-14T07:05:00.000Z',
        })
        .mockResolvedValueOnce({
          id: 100,
          status: 'confirmed',
          hiker_id: 10,
          slot_id: 101,
          party_size: 3,
          slot_date: '2026-08-16',
          slot_start_time: '14:00',
          slot_end_time: '16:00',
          meal: 'lunch',
          contact_name: 'Mario Rossi',
          email: 'mario.rossi@example.com',
          phone: '123',
          created_at: '2026-08-14T07:05:00.000Z',
        });

      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        date: '2026-08-16',
        start_time: '14:00',
        end_time: '16:00',
        meal: 'lunch',
      });

      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 },
      ]);

      bookingDao.getSeatAssignments.mockResolvedValue([
        { tableId: 1, tableLabel: 'T1', seats: 3 },
      ]);

      const result = await bookingService.updateBooking(mockHiker, 100, { partySize: 3 });

      expect(result.partySize).toBe(3);
      expect(bookingDao.update).toHaveBeenCalled();
    });
  });

  describe('cancelBooking', () => {
    it('should throw an UnauthorizedError if user is not authenticated', async () => {
      await expect(bookingService.cancelBooking(null, 100)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw a NotFoundError if booking ID format is invalid', async () => {
      await expect(bookingService.cancelBooking(mockHiker, 'invalid')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should successfully cancel a confirmed booking', async () => {
      bookingDao.findById
        .mockResolvedValueOnce({
          id: 100,
          status: 'confirmed',
          hiker_id: 10,
          slot_id: 101,
          party_size: 2,
          slot_date: '2026-08-16',
          slot_start_time: '14:00',
          slot_end_time: '16:00',
          meal: 'lunch',
          contact_name: 'Mario Rossi',
          email: 'mario.rossi@example.com',
          phone: '123',
          created_at: '2026-08-14T07:05:00.000Z',
        })
        .mockResolvedValueOnce({
          id: 100,
          status: 'cancelled',
          hiker_id: 10,
          slot_id: 101,
          party_size: 2,
          slot_date: '2026-08-16',
          slot_start_time: '14:00',
          slot_end_time: '16:00',
          meal: 'lunch',
          contact_name: 'Mario Rossi',
          email: 'mario.rossi@example.com',
          phone: '123',
          created_at: '2026-08-14T07:05:00.000Z',
        });

      bookingDao.cancelIfConfirmed.mockResolvedValue(true);
      bookingDao.getSeatAssignments.mockResolvedValue([]);

      const result = await bookingService.cancelBooking(mockHiker, 100);

      expect(result.status).toBe('cancelled');
      expect(result.alreadyCancelled).toBe(false);
    });

    it('should be idempotent when cancelling an already cancelled booking', async () => {
      const cancelledBooking = {
        id: 100,
        status: 'cancelled',
        hiker_id: 10,
        slot_id: 101,
        party_size: 2,
        slot_date: '2026-08-16',
        slot_start_time: '14:00',
        slot_end_time: '16:00',
        meal: 'lunch',
        contact_name: 'Mario Rossi',
        email: 'mario.rossi@example.com',
        phone: '123',
        created_at: '2026-08-14T07:05:00.000Z',
      };
      bookingDao.findById.mockResolvedValue(cancelledBooking);
      bookingDao.getSeatAssignments.mockResolvedValue([]);

      const result = await bookingService.cancelBooking(mockHiker, 100);

      expect(result.alreadyCancelled).toBe(true);
      expect(result.cancellationEmail).toEqual({ status: 'skipped' });
      expect(bookingDao.cancelIfConfirmed).not.toHaveBeenCalled();
    });
  });

  describe('listBookings & checkSlotBooking (Additional Black-Box Coverage)', () => {
    it('should throw UnauthorizedError if listBookings is called without user', async () => {
      await expect(bookingService.listBookings(null)).rejects.toThrow(UnauthorizedError);
    });

    it('should list bookings for the authenticated hiker with empty results handled', async () => {
      bookingDao.listByHiker.mockResolvedValue([]);

      const results = await bookingService.listBookings(mockHiker);
      expect(results.bookings).toHaveLength(0);
    });

    it('should list bookings for the authenticated hiker with active items', async () => {
      bookingDao.listByHiker.mockResolvedValue([
        {
          id: 100,
          status: 'confirmed',
          slot_id: 101,
          slot_date: '2026-08-14',
          slot_start_time: '14:00',
          party_size: 2,
        },
      ]);
      bookingDao.getSeatAssignments.mockResolvedValue([]);

      const results = await bookingService.listBookings(mockHiker);
      expect(results.bookings).toHaveLength(1);
      expect(results.bookings[0].id).toBe(100);
    });

    it('should throw UnauthorizedError if checkSlotBooking is called without user', async () => {
      await expect(bookingService.checkSlotBooking(null, 101)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw ValidationError if checkSlotBooking receives an invalid slot ID', async () => {
      await expect(bookingService.checkSlotBooking(mockHiker, 'abc')).rejects.toThrow(
        ValidationError
      );
    });

    it('should check if slot is not booked correctly', async () => {
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue(null);

      const check = await bookingService.checkSlotBooking(mockHiker, 101);
      expect(check).toEqual({ alreadyBooked: false });
    });

    it('should check if slot is already booked correctly', async () => {
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue({ id: 50 });

      const check = await bookingService.checkSlotBooking(mockHiker, 101);
      expect(check).toEqual({ alreadyBooked: true });
    });
  });

  describe('searchHikers (Staff Feature)', () => {
    it('should throw UnauthorizedError if user is not authenticated', async () => {
      await expect(bookingService.searchHikers(null, 'Mario')).rejects.toThrow(UnauthorizedError);
    });

    it('should throw ForbiddenError if a non-staff user attempts to search hikers', async () => {
      await expect(bookingService.searchHikers(mockHiker, 'Mario')).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      });
    });

    it('should throw ValidationError if query is too short or too long', async () => {
      const userDao = { searchHikers: vi.fn() };
      const serviceWithDao = createBookingService({ db, bookingDao, slotDao, userDao, timeZone });

      await expect(serviceWithDao.searchHikers(mockStaff, 'a')).rejects.toThrow(ValidationError);
      await expect(serviceWithDao.searchHikers(mockStaff, 'x'.repeat(101))).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw 500 AppError if userDao searchHikers is unavailable', async () => {
      await expect(bookingService.searchHikers(mockStaff, 'Mario')).rejects.toBeInstanceOf(
        AppError
      );
    });

    it('should return mapped hikers successfully when query is valid', async () => {
      const userDao = {
        searchHikers: vi.fn().mockResolvedValue([
          { id: 15, name: 'Mario Rossi', email: 'mario@hut.test', phone: '+39333' },
        ]),
      };
      const serviceWithDao = createBookingService({ db, bookingDao, slotDao, userDao, timeZone });

      const result = await serviceWithDao.searchHikers(mockStaff, 'Mario');
      expect(result.hikers).toHaveLength(1);
      expect(result.hikers[0].name).toBe('Mario Rossi');
    });
  });

  describe('createStaffBooking (MH-07)', () => {
    it('should throw 500 AppError when userDao is not provided', async () => {
      await expect(
        bookingService.createStaffBooking(mockStaff, {
          slotId: 101,
          partySize: 2,
          mode: 'guest',
          contactName: 'Guest',
        })
      ).rejects.toBeInstanceOf(AppError);
    });

    it('should successfully create a staff booking in guest mode', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        start_time: '15:00',
        end_time: '17:00',
        date: '2026-08-14',
        meal: 'lunch',
      });
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 },
      ]);
      bookingDao.create.mockResolvedValue(200);
      bookingDao.findById.mockResolvedValue({
        id: 200,
        status: 'confirmed',
        hiker_id: null,
        created_by: 1,
        slot_id: 101,
        slot_date: '2026-08-14',
        slot_start_time: '15:00',
        slot_end_time: '17:00',
        meal: 'lunch',
        party_size: 2,
        contact_name: 'Walk-in Guest',
        email: 'guest@hut.test',
        phone: null,
        created_at: '2026-08-14T07:05:00.000Z',
      });
      bookingDao.getSeatAssignments.mockResolvedValue([
        { tableId: 1, tableLabel: 'T1', seats: 2 },
      ]);

      const userDao = {};
      const serviceWithDao = createBookingService({
        db,
        bookingDao,
        slotDao,
        userDao,
        timeZone,
        now: () => fixedNow,
      });

      const result = await serviceWithDao.createStaffBooking(mockStaff, {
        slotId: 101,
        partySize: 2,
        mode: 'guest',
        contactName: 'Walk-in Guest',
        email: 'guest@hut.test',
      });
      expect(result.id).toBe(200);
      expect(result.mode).toBe('guest');
    });

    it('should create a staff booking for an existing hiker and reject unknown hiker', async () => {
      const userDao = {
        findById: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 25,
            name: 'Giulia Verdi',
            email: 'giulia@hut.test',
            phone: '+39340',
            role: 'hiker',
          }),
      };
      const serviceWithDao = createBookingService({
        db,
        bookingDao,
        slotDao,
        userDao,
        timeZone,
        now: () => fixedNow,
      });

      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        start_time: '15:00',
        end_time: '17:00',
        date: '2026-08-14',
        meal: 'lunch',
      });
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 },
      ]);
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue(null);
      bookingDao.create.mockResolvedValue(201);
      bookingDao.findById.mockResolvedValue({
        id: 201,
        status: 'confirmed',
        hiker_id: 25,
        created_by: 1,
        slot_id: 101,
        slot_date: '2026-08-14',
        slot_start_time: '15:00',
        slot_end_time: '17:00',
        meal: 'lunch',
        party_size: 2,
        contact_name: 'Giulia Verdi',
        email: 'giulia@hut.test',
        phone: '+39340',
        created_at: '2026-08-14T07:05:00.000Z',
      });
      bookingDao.getSeatAssignments.mockResolvedValue([
        { tableId: 1, tableLabel: 'T1', seats: 2 },
      ]);

      await expect(
        serviceWithDao.createStaffBooking(mockStaff, {
          slotId: 101,
          partySize: 2,
          mode: 'existingHiker',
          hikerId: 999,
        })
      ).rejects.toMatchObject({ status: 404, code: 'HIKER_NOT_FOUND' });

      const result = await serviceWithDao.createStaffBooking(mockStaff, {
        slotId: 101,
        partySize: 2,
        mode: 'existingHiker',
        hikerId: 25,
      });
      expect(result.hikerId).toBe(25);
      expect(result.mode).toBe('existingHiker');
    });

    it('should create a new hiker account with initialPassword in newHiker mode and reject duplicate emails', async () => {
      const userDao = {
        findByEmail: vi
          .fn()
          .mockResolvedValueOnce({ id: 99 })
          .mockResolvedValueOnce(null),
        createHiker: vi.fn().mockResolvedValue({
          id: 30,
          name: 'Luca Bianchi',
          email: 'luca@hut.test',
          phone: '+393331234567',
          role: 'hiker',
        }),
      };
      const serviceWithDao = createBookingService({
        db,
        bookingDao,
        slotDao,
        userDao,
        timeZone,
        now: () => fixedNow,
      });

      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        start_time: '15:00',
        end_time: '17:00',
        date: '2026-08-14',
        meal: 'lunch',
      });
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 },
      ]);
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue(null);
      bookingDao.create.mockResolvedValue(202);
      bookingDao.findById.mockResolvedValue({
        id: 202,
        status: 'confirmed',
        hiker_id: 30,
        created_by: 1,
        slot_id: 101,
        slot_date: '2026-08-14',
        slot_start_time: '15:00',
        slot_end_time: '17:00',
        meal: 'lunch',
        party_size: 2,
        contact_name: 'Luca Bianchi',
        email: 'luca@hut.test',
        phone: '+393331234567',
        created_at: '2026-08-14T07:05:00.000Z',
      });
      bookingDao.getSeatAssignments.mockResolvedValue([
        { tableId: 1, tableLabel: 'T1', seats: 2 },
      ]);

      await expect(
        serviceWithDao.createStaffBooking(mockStaff, {
          slotId: 101,
          partySize: 2,
          mode: 'newHiker',
          name: 'Luca Bianchi',
          email: 'luca@hut.test',
          phone: '+393331234567',
        })
      ).rejects.toMatchObject({ status: 409, code: 'EMAIL_ALREADY_REGISTERED' });

      const result = await serviceWithDao.createStaffBooking(mockStaff, {
        slotId: 101,
        partySize: 2,
        mode: 'newHiker',
        name: 'Luca Bianchi',
        email: 'luca@hut.test',
        phone: '+393331234567',
      });
      expect(result.mode).toBe('newHiker');
      expect(result.account).toMatchObject({
        id: 30,
        email: 'luca@hut.test',
        passwordChangeRequired: true,
      });
      expect(typeof result.initialPassword).toBe('string');
      expect(result.initialPassword.length).toBeGreaterThan(0);
    });
  });
});