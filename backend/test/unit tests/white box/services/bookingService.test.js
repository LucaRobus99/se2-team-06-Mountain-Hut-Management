import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBookingService } from '../../../../src/services/bookingService.js';
import { ValidationError, AppError, NotFoundError } from '../../../../src/errors/AppError.js';

describe('bookingService - White-Box Tests', () => {
  let db;
  let bookingDao;
  let slotDao;
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

    it('should validate email format and throw ValidationError for invalid emails when booked by staff', async () => {
      try {
        await bookingService.createBooking(mockStaff, {
          slotId: 101,
          partySize: 2,
          email: 'invalid-email-format',
        });
        expect.fail('Should have thrown ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'email', rule: 'invalid' })
          ])
        );
      }
    });

    it('should throw ValidationError if staff provides contactName exceeding maximum length', async () => {
      try {
        await bookingService.createBooking(mockStaff, {
          slotId: 101,
          partySize: 2,
          contactName: 'A'.repeat(101), // Max length is 100
        });
        expect.fail('Should have thrown ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'contactName', rule: 'too_long' })
          ])
        );
      }
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

    it('should flag invalid phone/contactNumber types or values when booked by staff', async () => {
      try {
        await bookingService.createBooking(mockStaff, {
          slotId: 101,
          partySize: 2,
          contactNumber: 123456789, 
        });
        expect.fail('Should have thrown ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'contactNumber', rule: 'invalid' })
          ])
        );
      }
    });

    it('should require at least one contact field if staff provides none', async () => {
      try {
        await bookingService.createBooking(mockStaff, {
          slotId: 101,
          partySize: 2,
        });
        expect.fail('Should have thrown ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'contact', rule: 'required' })
          ])
        );
      }
    });

    it('should successfully validate when staff provides valid contact details', async () => {
      slotDao.findById.mockResolvedValue({ 
        id: 101, 
        status: 'available', 
        start_time: '14:00', 
        end_time: '16:00',
        date: '2026-08-14',
        meal: 'lunch'
      });
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 }
      ]);
      bookingDao.create.mockResolvedValue(200);
      bookingDao.findById.mockResolvedValue({
        id: 200,
        status: 'confirmed',
        hiker_id: null,
        created_by: 1,
        slot_id: 101,
        slot_date: '2026-08-14',
        slot_start_time: '14:00',
        slot_end_time: '16:00',
        meal: 'lunch',
        party_size: 2,
        contact_name: 'Guest User',
        email: 'guest@example.com',
        phone: '+393339998877',
        created_at: '2026-08-14T07:05:00.000Z',
      });
      bookingDao.getSeatAssignments.mockResolvedValue([
        { tableId: 1, tableLabel: 'T1', seats: 2 }
      ]);

      const result = await bookingService.createBooking(mockStaff, {
        slotId: 101,
        partySize: 2,
        contactName: 'Guest User',
        email: 'guest@example.com',
        contactNumber: '+393339998877',
      });

      expect(result.createdBy).toBe(1);
      expect(result.contactName).toBe('Guest User');
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
    
    it('should support notifier passed as a direct function', async () => {
      const directNotifierFn = vi.fn().mockResolvedValue(true);

      const serviceWithFnNotifier = createBookingService({
        db,
        bookingDao,
        slotDao,
        timeZone,
        now: () => fixedNow,
        emailService: directNotifierFn,
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

      await serviceWithFnNotifier.createBooking(mockHiker, { slotId: 101, partySize: 2 });
      expect(directNotifierFn).toHaveBeenCalled();
    });

  });

  describe('Internal GetBooking Permission Branches', () => {
    
    it('should allow staff to read any booking regardless of hiker_id', async () => {
      bookingDao.findById.mockResolvedValue({
        id: 150,
        status: 'confirmed',
        hiker_id: 99, // Different hiker
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

      // Test with non-object entry inside array
      await expect(
        bookingService.createBooking(mockHiker, { 
          slotId: 101, 
          partySize: 2, 
          requirements: [null] 
        })
      ).rejects.toThrow(ValidationError);

      // Test with description too long (>500 chars)
      await expect(
        bookingService.createBooking(mockHiker, { 
          slotId: 101, 
          partySize: 2, 
          requirements: [{ description: 'a'.repeat(501), allergies: true }] 
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should fallback to body requirements if getRequirements getter throws an error', async () => {
      slotDao.findById.mockResolvedValue({ 
        id: 101, status: 'available', start_time: '14:00', end_time: '16:00', date: '2026-08-14', meal: 'lunch' 
      });
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue(null);
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([{ id: 1, label: 'T1', seats: 4, free: 4 }]);
      
      bookingDao.insertRequirements = vi.fn().mockResolvedValue(true);
      // Simulate getter throwing an error to test the catch fallback branch
      bookingDao.getRequirements = vi.fn().mockRejectedValue(new Error('DB read error'));

      bookingDao.create.mockResolvedValue(105);
      bookingDao.findById.mockResolvedValue({
        id: 105, status: 'confirmed', hiker_id: 10, slot_id: 101, slot_date: '2026-08-14',
        slot_start_time: '14:00', slot_end_time: '16:00', meal: 'lunch', party_size: 2,
        contact_name: 'Mario', email: 'm@example.com', phone: '123', created_at: '2026-08-14T07:05:00.000Z'
      });
      bookingDao.getSeatAssignments.mockResolvedValue([{ tableId: 1, tableLabel: 'T1', seats: 2 }]);

      const result = await bookingService.createBooking(mockHiker, {
        slotId: 101,
        partySize: 2,
        requirements: [{ description: 'Gluten-free', allergies: false }]
      });

      // Should fallback gracefully and return requirements from body normalization
      expect(result.requirements).toEqual([{ description: 'Gluten-free', allergies: false }]);
    });

  });

});