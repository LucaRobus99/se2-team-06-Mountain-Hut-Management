import { describe, it, expect } from 'vitest';
import { assertSlotOpen, seatOrFail } from '../../../../src/services/bookingRules.js';
import { ConflictError, UnprocessableEntityError } from '../../../../src/errors/AppError.js';

describe('bookingRules - White-Box Tests', () => {

  describe('assertSlotOpen internal error codes and messages', () => {
    
    it('should throw ConflictError with code SLOT_NOT_AVAILABLE when status is not available', () => {
      const slot = { status: 'off' };
      
      try {
        assertSlotOpen(slot, { timeZone: 'Europe/Rome', now: new Date() });
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError);
        expect(err.code).toBe('SLOT_NOT_AVAILABLE');
        expect(err.message).toBe('Slot is not available.');
      }
    });

    it('should throw UnprocessableEntityError with code SLOT_TOO_LATE when booking is too late', () => {
      const slot = { status: 'available', date: '2026-08-14', start_time: '11:00' };
      const now = new Date('2026-08-14T09:30:00.000Z'); // 1h30m before

      try {
        assertSlotOpen(slot, { timeZone: 'Europe/Rome', now });
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).toBeInstanceOf(UnprocessableEntityError);
        expect(err.code).toBe('SLOT_TOO_LATE');
        expect(err.message).toBe('Bookings close two hours before the slot starts.');
      }
    });

  });

  describe('seatOrFail internal error codes and empty details array', () => {
    
    it('should throw ConflictError with code INSUFFICIENT_CAPACITY and empty details array on failure', () => {
      const partySize = 5;
      const tables = [{ id: 1, seats: 2, free: 2 }];

      try {
        seatOrFail(partySize, tables);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError);
        expect(err.code).toBe('INSUFFICIENT_CAPACITY');
        expect(err.details).toEqual([]);
        expect(err.message).toBe('Insufficient capacity.');
      }
    });

  });

});