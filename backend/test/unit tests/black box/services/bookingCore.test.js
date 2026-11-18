import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBookingResponse, runInTransaction, createBookingCore } from '../../../../src/services/bookingCore.js';
import { AppError, NotFoundError, ConflictError } from '../../../../src/errors/AppError.js';

describe('bookingCore - Black-Box Tests', () => {

  describe('toBookingResponse (API formatting)', () => {
    it('should correctly format a standard single-table booking response', () => {
      const mockBooking = {
        id: 1,
        status: 'confirmed',
        hiker_id: 10,
        created_by: null,
        slot_id: 100,
        slot_date: '2026-08-14',
        slot_start_time: '12:00',
        slot_end_time: '14:00',
        meal: 'lunch',
        party_size: 2,
        contact_name: 'Mario Rossi',
        email: 'mario@example.com',
        phone: '+393331234567',
        created_at: '2026-08-10T10:00:00.000Z',
      };
      const assignments = [{ tableId: 1, tableLabel: 'T1', seats: 2 }];
      const requirements = [{ description: 'Vegetarian', allergies: false }];

      const response = toBookingResponse(mockBooking, assignments, requirements);

      expect(response).toEqual({
        id: 1,
        status: 'confirmed',
        hikerId: 10,
        createdBy: null,
        slot: {
          id: 100,
          date: '2026-08-14',
          startTime: '12:00',
          endTime: '14:00',
          meal: 'lunch',
        },
        partySize: 2,
        contactName: 'Mario Rossi',
        email: 'mario@example.com',
        contactNumber: '+393331234567',
        requirements,
        split: false,
        seatAssignments: [{ tableId: 1, tableLabel: 'T1', seats: 2 }],
        createdAt: '2026-08-10T10:00:00.000Z',
      });
      expect(response.notice).toBeUndefined();
    });

    it('should include split notice when assignments span multiple tables', () => {
      const mockBooking = {
        id: 2,
        status: 'confirmed',
        party_size: 4,
        slot_id: 100,
        slot_date: '2026-08-14',
        slot_start_time: '12:00',
      };
      const assignments = [
        { tableId: 1, tableLabel: 'T1', seats: 2 },
        { tableId: 2, tableLabel: 'T2', seats: 2 },
      ];

      const response = toBookingResponse(mockBooking, assignments, []);

      expect(response.split).toBe(true);
      expect(response.notice).toEqual({
        code: 'GROUP_SPLIT',
        message: 'The group will be seated across multiple tables.',
      });
    });
  });

  describe('runInTransaction', () => {
    it('should return the result of transaction callback if successful', async () => {
      const db = { transaction: vi.fn(async (cb) => cb('tx-mock')) };
      const result = await runInTransaction(db, async (tx) => 'success');

      expect(result).toBe('success');
      expect(db.transaction).toHaveBeenCalledTimes(1);
    });

    it('should pass through AppError instances without modification', async () => {
      const db = {
        transaction: vi.fn(async () => {
          throw new ConflictError('Custom conflict', 'CONFLICT_CODE');
        }),
      };

      await expect(runInTransaction(db, async () => {})).rejects.toThrow(ConflictError);
    });

    it('should wrap non-AppError exceptions into a generic 500 AppError', async () => {
      const db = {
        transaction: vi.fn(async () => {
          throw new Error('Database crash');
        }),
      };

      try {
        await runInTransaction(db, async () => {});
        expect.fail('Should have thrown AppError');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.status).toBe(500);
        expect(err.code).toBe('INTERNAL_ERROR');
      }
    });
  });

});