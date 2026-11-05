import { describe, it, expect } from 'vitest';
import { assertSlotOpen, seatOrFail } from '../../../../src/services/bookingRules.js';
import { ConflictError, UnprocessableEntityError } from '../../../../src/errors/AppError.js';

describe('bookingRules - Black-Box Tests', () => {

  describe('assertSlotOpen', () => {
    
    it('should pass successfully when the slot is available and far enough in the future', () => {
      const slot = { status: 'available', date: '2026-08-14', start_time: '15:00' };
      const timeZone = 'Europe/Rome';
      const now = new Date('2026-08-14T09:00:00.000Z'); // Well before 2 hours threshold

      expect(() => assertSlotOpen(slot, { timeZone, now })).not.toThrow();
    });

    it('should throw a ConflictError if the slot status is not available (e.g., off)', () => {
      const slot = { status: 'off', date: '2026-08-14', start_time: '15:00' };
      const timeZone = 'Europe/Rome';
      const now = new Date('2026-08-14T09:00:00.000Z');

      expect(() => assertSlotOpen(slot, { timeZone, now })).toThrow(ConflictError);
    });

    it('should throw an UnprocessableEntityError if bookings are closed (< 2 hours before start)', () => {
      const slot = { status: 'available', date: '2026-08-14', start_time: '11:00' };
      const timeZone = 'Europe/Rome';
      const now = new Date('2026-08-14T09:30:00.000Z'); // Only 1h30m before start

      expect(() => assertSlotOpen(slot, { timeZone, now })).toThrow(UnprocessableEntityError);
    });

  });

  describe('seatOrFail', () => {
    
    it('should return the computed seating arrangement when capacity is sufficient', () => {
      const partySize = 2;
      const tables = [{ id: 1, label: 'T1', seats: 4, free: 4 }];

      const result = seatOrFail(partySize, tables);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    it('should throw a ConflictError when tables do not have enough capacity for the party', () => {
      const partySize = 10;
      const tables = [{ id: 1, label: 'T1', seats: 4, free: 2 }];

      expect(() => seatOrFail(partySize, tables)).toThrow(ConflictError);
    });

  });

});