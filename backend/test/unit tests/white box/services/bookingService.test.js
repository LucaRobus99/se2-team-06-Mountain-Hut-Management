import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBookingService } from '../../../../src/services/bookingService.js';
import { ValidationError, AppError, NotFoundError, ConflictError } from '../../../../src/errors/AppError.js';

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
      findById: vi.fn(),
      getSeatAssignments: vi.fn(),
      insertRequirements: vi.fn(),
      replaceRequirements: vi.fn(),
      getRequirements: vi.fn().mockResolvedValue([]),
      getRequirementsByBookingIds: vi.fn().mockResolvedValue(new Map()),
      update: vi.fn(),
      cancelIfConfirmed: vi.fn(),
    };

    slotDao = {
      findById: vi.fn(),
      getTablesWithFreeForSlot: vi.fn(),
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
          expect.arrayContaining([
            expect.objectContaining({ field: 'body', rule: 'invalid' })
          ])
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
            expect.objectContaining({ field: 'unknownParam', rule: 'unknown' })
          ])
        );
      }
    });

    it('should refuse contact fields from a hiker: they come from the profile', async () => {
      await expect(
        bookingService.createBooking(mockHiker, { slotId: 101, partySize: 2, email: 'other@example.com' })
      ).rejects.toMatchObject({
        details: expect.arrayContaining([expect.objectContaining({ field: 'email', rule: 'not_allowed' })]),
      });
    });

    it('should refuse staff: MH-07 bookings go through createStaffBooking', async () => {
      await expect(
        bookingService.createBooking(mockStaff, { slotId: 101, partySize: 2, contactName: 'Guest' })
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
            expect.objectContaining({ field: 'partySize' })
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
        date: '2026-08-14' 
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
        meal: 'lunch'
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

      bookingDao.getSeatAssignments?.mockResolvedValue([
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

      const result = await serviceWithFnNotifier.createBooking(mockHiker, { slotId: 101, partySize: 2 });
      expect(directNotifierFn).toHaveBeenCalledWith('created', 'm@example.com', expect.objectContaining({
        booking_id: 100,
        guests: 2,
        party_requirements: [],
      }));
      expect(result.confirmationEmail).toEqual({ status: 'sent' });
    });

  });

  describe('Internal GetBooking Permission Branches', () => {
    
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
        { tableId: 1, tableLabel: 'T1', seats: 2 }
      ]);

      const result = await bookingService.getBooking(150, mockStaff);
      expect(result.id).toBe(150);
    });

  });

  describe('Internal Party Requirements & Validation Branches', () => {

    it('should throw ValidationError if requirements is not an array', async () => {
      slotDao.findById.mockResolvedValue({ 
        id: 101, status: 'available', start_time: '14:00', date: '2026-08-14' 
      });

      await expect(
        bookingService.createBooking(mockHiker, { 
          slotId: 101, 
          partySize: 2, 
          requirements: 'not-an-array' 
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if a requirement entry is not a valid object or has invalid description/allergies', async () => {
      slotDao.findById.mockResolvedValue({ 
        id: 101, status: 'available', start_time: '14:00', date: '2026-08-14' 
      });

      await expect(
        bookingService.createBooking(mockHiker, { 
          slotId: 101, 
          partySize: 2, 
          requirements: [null] 
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        bookingService.createBooking(mockHiker, { 
          slotId: 101, 
          partySize: 2, 
          requirements: [{ description: 'a'.repeat(501), allergies: true }] 
        })
      ).rejects.toThrow(ValidationError);
    });

  });

  describe('Additional White-Box Coverage (Update, Cancel & Staff Flows)', () => {

    it('should throw ValidationError in validateUpdateBody if body is not an object', async () => {
      await expect(
        bookingService.updateBooking(mockHiker, 100, null)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError in validateUpdateBody if no fields are provided for update', async () => {
      await expect(
        bookingService.updateBooking(mockHiker, 100, {})
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError if booking ID is null or invalid in updateBooking', async () => {
      await expect(
        bookingService.updateBooking(mockHiker, 'invalid', { partySize: 3 })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw UnauthorizedError if createStaffBooking is called without user or non-staff', async () => {
      await expect(
        bookingService.createStaffBooking(mockHiker, { mode: 'guest', slotId: 101, partySize: 2, contactName: 'Guest' })
      ).rejects.toThrow();
    });

    it('should throw ValidationError in searchHikers if query is too short or too long', async () => {
      await expect(
        bookingService.searchHikers(mockStaff, 'a')
      ).rejects.toThrow(ValidationError);

      await expect(
        bookingService.searchHikers(mockStaff, 'a'.repeat(105))
      ).rejects.toThrow(ValidationError);
    });

 

    it('should handle idempotent cancellation in cancelBooking if already cancelled', async () => {
      db.transaction = vi.fn(async (cb) => cb('mock-tx'));

      bookingDao.findById.mockResolvedValue({
        id: 100,
        status: 'cancelled',
        hiker_id: 10,
        slot_id: 101,
        party_size: 2,
        slot_date: '2026-08-25',
        slot_start_time: '14:00',
      });

      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'booked',
        date: '2026-08-25',
        start_time: '14:00',
      });

      bookingDao.cancelIfConfirmed.mockResolvedValue(false);
      bookingDao.getSeatAssignments.mockResolvedValue([]);
      bookingDao.getRequirements.mockResolvedValue([]);

      const result = await bookingService.cancelBooking(mockHiker, 100);
      
      expect(result.alreadyCancelled).toBe(true);
      expect(bookingDao.cancelIfConfirmed).not.toHaveBeenCalled();
    });

    it('should successfully resolve newHiker mode in createStaffBooking', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        date: '2026-08-25',
        start_time: '14:00',
        meal: 'lunch',
      });

      userDao.findByEmail.mockResolvedValue(null);
      userDao.createHiker.mockResolvedValue({
        id: 55,
        name: 'New Hiker',
        email: 'new@example.com',
        phone: '+393339998877',
      });

      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 }
      ]);

      bookingDao.create.mockResolvedValue(200);
      bookingDao.findById.mockResolvedValue({
        id: 200,
        status: 'confirmed',
        hiker_id: 55,
        created_by: 1,
        slot_id: 101,
        slot_date: '2026-08-25',
        slot_start_time: '14:00',
        party_size: 2,
        contact_name: 'New Hiker',
        email: 'new@example.com',
        phone: '+393339998877',
        created_at: '2026-08-14T07:05:00.000Z',
      });
      bookingDao.getSeatAssignments.mockResolvedValue([]);

      const response = await bookingService.createStaffBooking(mockStaff, {
        slotId: 101,
        partySize: 2,
        mode: 'newHiker',
        name: 'New Hiker',
        email: 'new@example.com',
        phone: '+393339998877',
      });

      expect(response.mode).toBe('newHiker');
      expect(response.account).toBeDefined();
      expect(response.initialPassword).toBeDefined();
      expect(userDao.createHiker).toHaveBeenCalled();
    });

  });
it('should throw ConflictError if email is already registered when creating a staff booking in newHiker mode', async () => {
      slotDao.findById.mockResolvedValue({
        id: 101,
        status: 'available',
        date: '2026-08-25',
        start_time: '14:00',
        meal: 'lunch',
      });

      // Simula che l'email esista già nel database
      userDao.findByEmail.mockResolvedValue({ id: 99, email: 'existing@example.com' });

      await expect(
        bookingService.createStaffBooking(mockStaff, {
          slotId: 101,
          partySize: 2,
          mode: 'newHiker',
          name: 'Existing Person',
          email: 'existing@example.com',
          phone: '+393330000000', // Aggiunto per superare la validazione iniziale del corpo
        })
      ).rejects.toThrow(ConflictError);
    });
});