import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBookingService } from '../../../../src/services/bookingService.js';
import {
  ValidationError,
  AppError,
  NotFoundError,
  UnauthorizedError,
} from '../../../../src/errors/AppError.js';

describe('bookingService - White-Box Tests', () => {
  let db;
  let bookingDao;
  let slotDao;
  let userDao;
  let bookingService;
  const timeZone = 'Europe/Rome';
  const fixedNow = new Date('2026-08-14T07:00:00.000Z');

  const mockHiker = {
    id: 10,
    displayName: 'Mario Rossi',
    email: 'mario.rossi@example.com',
    phone: '+393331234567',
    role: 'hiker',
  };

  const mockStaff = {
    id: 1,
    displayName: 'Warden Staff',
    email: 'warden@hut.test',
    role: 'warden',
  };

  beforeEach(() => {
    db = {
      transaction: vi.fn(async (callback) => callback('mock-tx')),
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    bookingDao = {
      findConfirmedByHikerAndSlot: vi.fn(),
      create: vi.fn(),
      insertSeats: vi.fn(),
      deleteSeats: vi.fn(),
      update: vi.fn(),
      findById: vi.fn(),
      getSeatAssignments: vi.fn(),
      insertRequirements: vi.fn(),
      replaceRequirements: vi.fn(),
      getRequirements: vi.fn().mockResolvedValue([]),
      getRequirementsByBookingIds: vi.fn().mockResolvedValue(new Map()),
      listByHiker: vi.fn(),
      cancelIfConfirmed: vi.fn(),
    };

    slotDao = {
      findById: vi.fn(),
      listByDate: vi.fn(),
      getTablesWithFreeForSlot: vi.fn(),
      getTablesWithFreeForSlots: vi.fn(),
    };

    userDao = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      createHiker: vi.fn(),
      searchHikers: vi.fn(),
    };

    bookingService = createBookingService({
      db,
      bookingDao,
      slotDao,
      userDao,
      timeZone,
      now: () => fixedNow,
    });
  });

  describe('Internal Body Validation Branches (validateBookingBody)', () => {
    it('should throw ValidationError if request body is an array or not an object', async () => {
      try {
        await bookingService.createBooking(mockHiker, [1, 2, 3]);
        expect.fail('Should have thrown ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'body', rule: 'invalid' })])
        );
      }
    });

    it('should catch unknown fields and add them to validation details', async () => {
      try {
        await bookingService.createBooking(mockHiker, {
          slotId: 101,
          partySize: 2,
          unknownParam: 'not-allowed',
        });
        expect.fail('Should have thrown ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'unknownParam', rule: 'unknown' }),
          ])
        );
      }
    });

    it('should refuse contact fields from a hiker: they come from the profile', async () => {
      await expect(
        bookingService.createBooking(mockHiker, {
          slotId: 101,
          partySize: 2,
          email: 'other@example.com',
        })
      ).rejects.toMatchObject({
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'email', rule: 'not_allowed' }),
        ]),
      });
    });

    it('should refuse staff: MH-07 bookings go through createStaffBooking', async () => {
      await expect(
        bookingService.createBooking(mockStaff, {
          slotId: 101,
          partySize: 2,
          contactName: 'Guest',
        })
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('should throw ValidationError if slotId or partySize are not positive integers', async () => {
      try {
        await bookingService.createBooking(mockHiker, {
          slotId: -1,
          partySize: 0,
        });
        expect.fail('Should have thrown ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'slotId' }),
            expect.objectContaining({ field: 'partySize' }),
          ])
        );
      }
    });
  });

  describe('Internal Transaction Error Handling (try...catch wrapper)', () => {
    it('should catch non-AppError exceptions inside the transaction and wrap them into a 500 AppError', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        start_time: '14:00',
        date: '2026-08-14',
      });

      db.transaction.mockImplementationOnce(async () => {
        throw new Error('Database connection lost unexpectedly');
      });

      try {
        await bookingService.createBooking(mockHiker, { slotId: 101, partySize: 2 });
        expect.fail('Should have thrown AppError');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.status).toBe(500);
        expect(err.code).toBe('INTERNAL_ERROR');
      }
    });
  });

  describe('Internal Response Formatting Branches (toBookingResponse)', () => {
    it('should include a notice property in response when the group is split across tables', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        start_time: '14:00',
        date: '2026-08-14',
        meal: 'lunch',
      });
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue(null);
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 2, free: 2 },
        { id: 2, label: 'T2', seats: 2, free: 2 },
      ]);
      bookingDao.create.mockResolvedValue(100);
      bookingDao.findById.mockResolvedValue({
        id: 100,
        status: 'confirmed',
        hiker_id: 10,
        slot_id: 101,
        slot_date: '2026-08-14',
        slot_start_time: '14:00',
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
  });

  describe('Email Notifier Variations Branches', () => {
    it('should send the confirmation through emailService.sendBookingEmail with kind "created"', async () => {
      const directNotifierFn = vi.fn().mockResolvedValue({ id: 'msg-1' });

      const serviceWithFnNotifier = createBookingService({
        db,
        bookingDao,
        slotDao,
        timeZone,
        now: () => fixedNow,
        emailService: { sendBookingEmail: directNotifierFn },
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

      const result = await serviceWithFnNotifier.createBooking(mockHiker, {
        slotId: 101,
        partySize: 2,
      });
      expect(directNotifierFn).toHaveBeenCalledWith(
        'created',
        'm@example.com',
        expect.objectContaining({
          booking_id: 100,
          guests: 2,
          party_requirements: [],
        })
      );
      expect(result.confirmationEmail).toEqual({ status: 'sent' });
    });
  });

  describe('Internal GetBooking, ListBookings & CheckSlotBooking Branches', () => {
    it('should allow staff to read any booking regardless of hiker_id', async () => {
      bookingDao.findById.mockResolvedValue({
        id: 150,
        status: 'confirmed',
        hiker_id: 99,
        created_by: 1,
        slot_id: 101,
        slot_date: '2026-08-14',
        slot_start_time: '14:00',
        party_size: 2,
        contact_name: 'Other Hiker',
        email: 'other@example.com',
        phone: '+393331112233',
        created_at: '2026-08-14T07:05:00.000Z',
      });
      bookingDao.getSeatAssignments.mockResolvedValue([
        { tableId: 1, tableLabel: 'T1', seats: 2 },
      ]);

      const result = await bookingService.getBooking(150, mockStaff);
      expect(result.id).toBe(150);
    });

    it('should list bookings with mapped requirements and handle checkSlotBooking edge cases', async () => {
      await expect(bookingService.listBookings(null)).rejects.toThrow(UnauthorizedError);
      await expect(bookingService.checkSlotBooking(null, 101)).rejects.toThrow(UnauthorizedError);
      await expect(bookingService.checkSlotBooking(mockHiker, 'bad')).rejects.toThrow(
        ValidationError
      );

      bookingDao.listByHiker.mockResolvedValue([
        { id: 10, status: 'confirmed', slot_id: 101, party_size: 2 },
      ]);
      bookingDao.getRequirementsByBookingIds.mockResolvedValue(
        new Map([[10, [{ description: 'Nut free', allergies: true }]]])
      );
      bookingDao.getSeatAssignments.mockResolvedValue([
        { tableId: 1, tableLabel: 'T1', seats: 2 },
      ]);

      const listed = await bookingService.listBookings(mockHiker);
      expect(listed.bookings[0].requirements).toEqual([
        { description: 'Nut free', allergies: true },
      ]);

      bookingDao.findConfirmedByHikerAndSlot
        .mockResolvedValueOnce({ id: 10 })
        .mockResolvedValueOnce(null);
      await expect(bookingService.checkSlotBooking(mockHiker, 101)).resolves.toEqual({
        alreadyBooked: true,
      });
      await expect(bookingService.checkSlotBooking(mockHiker, 102)).resolves.toEqual({
        alreadyBooked: false,
      });
    });
  });

  describe('Internal Party Requirements & Validation Branches', () => {
    it('should throw ValidationError if requirements is not an array', async () => {
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
          requirements: 'not-an-array',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if a requirement entry is not a valid object or has invalid description/allergies', async () => {
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
          requirements: [null],
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        bookingService.createBooking(mockHiker, {
          slotId: 101,
          partySize: 2,
          requirements: [{ description: 'a'.repeat(501), allergies: true }],
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('ListModificationSlots Branches', () => {
    it('should require auth and filter out non-matching or already-booked slots', async () => {
      await expect(
        bookingService.listModificationSlots(null, 100, {
          date: '2026-08-17',
          meal: 'lunch',
          partySize: 2,
        })
      ).rejects.toThrow(UnauthorizedError);

      bookingDao.findById.mockResolvedValue({
        id: 100,
        hiker_id: 10,
        status: 'confirmed',
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
          meal: 'lunch',
          date: '2026-08-17',
          start_time: '14:00',
          end_time: '16:00',
        },
        {
          id: 203,
          status: 'available',
          meal: 'lunch',
          date: '2026-08-17',
          start_time: '16:00',
          end_time: '18:00',
        },
      ]);
      slotDao.getTablesWithFreeForSlots.mockResolvedValue([
        { slot_id: 201, id: 1, label: 'T1', seats: 4, free: 4 },
        { slot_id: 202, id: 2, label: 'T2', seats: 4, free: 4 },
        { slot_id: 203, id: 3, label: 'T3', seats: 1, free: 1 },
      ]);
      bookingDao.findConfirmedByHikerAndSlot
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 999 });

      const res = await bookingService.listModificationSlots(mockHiker, 100, {
        date: '2026-08-17',
        meal: 'lunch',
        partySize: 2,
      });

      expect(res.slots).toHaveLength(1);
      expect(res.slots[0].id).toBe(201);
    });
  });

  describe('Additional White-Box Coverage (Update, Cancel & Staff Flows)', () => {
    it('rejects an update from a different hiker without releasing seats', async () => {
      bookingDao.findById.mockResolvedValue({ id: 100, hiker_id: 99, status: 'confirmed' });
      await expect(
        bookingService.updateBooking(mockHiker, 100, { partySize: 3 })
      ).rejects.toMatchObject({
        code: 'BOOKING_NOT_FOUND',
      });
      expect(bookingDao.deleteSeats).not.toHaveBeenCalled();
    });

    it('checks the original cutoff before any allocation', async () => {
      bookingDao.findById.mockResolvedValue({
        id: 100,
        hiker_id: 10,
        status: 'confirmed',
        slot_id: 101,
        party_size: 2,
      });
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        date: '2026-08-16',
        start_time: '08:59',
      });
      await expect(
        bookingService.updateBooking(mockHiker, 100, { partySize: 3 })
      ).rejects.toMatchObject({
        code: 'TOO_LATE_TO_MODIFY',
      });
      expect(bookingDao.deleteSeats).not.toHaveBeenCalled();
    });

    it('validates slot changes, target availability, and duplicate slot conflicts in updateBooking', async () => {
      bookingDao.findById.mockResolvedValue({
        id: 100,
        hiker_id: 10,
        status: 'confirmed',
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
          status: 'closed',
          date: '2026-08-17',
          start_time: '19:00',
        });

      await expect(
        bookingService.updateBooking(mockHiker, 100, { slotId: 102 })
      ).rejects.toMatchObject({ code: 'SLOT_NOT_AVAILABLE' });

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
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValueOnce({ id: 500 });

      await expect(
        bookingService.updateBooking(mockHiker, 100, { slotId: 102 })
      ).rejects.toMatchObject({ code: 'BOOKING_ALREADY_EXISTS' });
    });

    it('reallocates seats transactionally even when only requirements change', async () => {
      const existing = {
        id: 100,
        hiker_id: 10,
        status: 'confirmed',
        slot_id: 101,
        party_size: 2,
        email: null,
      };
      bookingDao.findById.mockResolvedValue(existing);
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        date: '2026-08-16',
        start_time: '09:00',
      });
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 2, free: 2 },
      ]);
      bookingDao.getSeatAssignments.mockResolvedValue([
        { tableId: 1, tableLabel: 'T1', seats: 2 },
      ]);

      const result = await bookingService.updateBooking(mockHiker, 100, { requirements: [] });
      expect(result.partySize).toBe(2);
      expect(bookingDao.deleteSeats).toHaveBeenCalledWith('mock-tx', 100);
      expect(bookingDao.update).toHaveBeenCalledWith('mock-tx', 100, { slotId: 101, partySize: 2 });
      expect(bookingDao.replaceRequirements).toHaveBeenCalledWith('mock-tx', 100, []);
    });

    it('should throw ValidationError in validateUpdateBody for non-object, empty body, extra fields or bad expectedSeating', async () => {
      await expect(bookingService.updateBooking(mockHiker, 100, null)).rejects.toThrow(
        ValidationError
      );
      await expect(bookingService.updateBooking(mockHiker, 100, {})).rejects.toThrow(
        ValidationError
      );
      await expect(
        bookingService.updateBooking(mockHiker, 100, { partySize: 2, extra: 1 })
      ).rejects.toThrow(ValidationError);
      await expect(
        bookingService.updateBooking(mockHiker, 100, {
          partySize: 2,
          expectedSeating: 'invalid_mode',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError if booking ID is null or invalid in updateBooking', async () => {
      await expect(
        bookingService.updateBooking(mockHiker, 'invalid', { partySize: 3 })
      ).rejects.toThrow(NotFoundError);
    });

    it('should handle cancelBooking for unauthenticated, non-confirmed, and confirmed bookings', async () => {
      await expect(bookingService.cancelBooking(null, 100)).rejects.toThrow(UnauthorizedError);
      await expect(bookingService.cancelBooking(mockHiker, 'invalid')).rejects.toThrow(
        NotFoundError
      );

      bookingDao.findById.mockResolvedValue({
        id: 100,
        hiker_id: 10,
        status: 'cancelled',
        slot_id: 101,
        party_size: 2,
      });
      bookingDao.getSeatAssignments.mockResolvedValue([]);

      const alreadyRes = await bookingService.cancelBooking(mockHiker, 100);
      expect(alreadyRes.alreadyCancelled).toBe(true);
      expect(alreadyRes.cancellationEmail).toEqual({ status: 'skipped' });
      expect(bookingDao.cancelIfConfirmed).not.toHaveBeenCalled();

      bookingDao.findById
        .mockResolvedValueOnce({
          id: 100,
          hiker_id: 10,
          status: 'confirmed',
          slot_id: 101,
          party_size: 2,
        })
        .mockResolvedValueOnce({
          id: 100,
          hiker_id: 10,
          status: 'cancelled',
          slot_id: 101,
          party_size: 2,
        });
      bookingDao.cancelIfConfirmed.mockResolvedValueOnce(true);

      const cancelledRes = await bookingService.cancelBooking(mockHiker, 100);
      expect(cancelledRes.alreadyCancelled).toBe(false);
      expect(bookingDao.cancelIfConfirmed).toHaveBeenCalledWith('mock-tx', 100);
    });

    it('should throw UnauthorizedError if createStaffBooking is called without user or non-staff', async () => {
      await expect(
        bookingService.createStaffBooking(mockHiker, {
          mode: 'guest',
          slotId: 101,
          partySize: 2,
          contactName: 'Guest',
        })
      ).rejects.toThrow();
    });

    it('should cover resolveOwner branches for existingHiker and newHiker in createStaffBooking', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        date: '2026-08-14',
        start_time: '15:00',
        end_time: '17:00',
        meal: 'lunch',
      });
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 },
      ]);
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue(null);
      bookingDao.create.mockResolvedValue(300);
      bookingDao.findById.mockResolvedValue({
        id: 300,
        status: 'confirmed',
        hiker_id: 22,
        created_by: 1,
        slot_id: 101,
        date: '2026-08-14',
        start_time: '15:00',
        end_time: '17:00',
        meal: 'lunch',
        party_size: 2,
        contact_name: 'Clara',
        email: 'clara@hut.test',
        phone: '+39333000111',
      });
      bookingDao.getSeatAssignments.mockResolvedValue([
        { tableId: 1, tableLabel: 'T1', seats: 2 },
      ]);

      userDao.findById.mockResolvedValueOnce({ id: 22, role: 'guest' });
      await expect(
        bookingService.createStaffBooking(mockStaff, {
          mode: 'existingHiker',
          slotId: 101,
          partySize: 2,
          hikerId: 22,
        })
      ).rejects.toMatchObject({ code: 'HIKER_NOT_FOUND' });

      userDao.findById.mockResolvedValueOnce({
        id: 22,
        role: 'hiker',
        name: 'Clara',
        email: 'clara@hut.test',
        phone: '+39333000111',
      });
      const existingRes = await bookingService.createStaffBooking(mockStaff, {
        mode: 'existingHiker',
        slotId: 101,
        partySize: 2,
        hikerId: 22,
      });
      expect(existingRes.hikerId).toBe(22);

      userDao.findByEmail.mockResolvedValueOnce(null);
      userDao.createHiker.mockResolvedValueOnce({
        id: 33,
        name: 'Paolo',
        email: 'paolo@hut.test',
        phone: '+39333000222',
      });
      const newHikerRes = await bookingService.createStaffBooking(mockStaff, {
        mode: 'newHiker',
        slotId: 101,
        partySize: 2,
        name: 'Paolo',
        email: 'paolo@hut.test',
        phone: '+39333000222',
      });
      expect(newHikerRes.account.passwordChangeRequired).toBe(true);
      expect(newHikerRes.initialPassword).toBeTruthy();
    });

    it('should throw ValidationError in searchHikers if query is too short or too long', async () => {
      await expect(bookingService.searchHikers(mockStaff, 'a')).rejects.toThrow(ValidationError);

      await expect(
        bookingService.searchHikers(mockStaff, 'a'.repeat(105))
      ).rejects.toThrow(ValidationError);
    });
  });
});