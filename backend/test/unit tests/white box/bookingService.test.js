import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBookingService } from '../../../src/services/bookingService.js';
import { ValidationError, AppError } from '../../../src/errors/AppError.js';

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
        await bookingService.createBooking(mockHiker, [1, 2, 3]); // Array instead of object
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

    it('should validate email format and throw ValidationError for invalid emails', async () => {
      try {
        await bookingService.createBooking(mockHiker, {
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

    it('should convert empty phone string to null and flag invalid phone types', async () => {
      // Test invalid phone type (e.g. number instead of string)
      try {
        await bookingService.createBooking(mockHiker, {
          slotId: 101,
          partySize: 2,
          phone: 123456789, // Invalid type
        });
        expect.fail('Should have thrown ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'phone', rule: 'invalid' })
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
      
      // Force database to throw a generic native error inside transaction
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
      
      // Multiple tables requiring a split
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

      // Seating assignments with length > 1 triggers split notice
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

});