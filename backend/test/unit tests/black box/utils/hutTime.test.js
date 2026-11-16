import { describe, it, expect } from 'vitest';
import { zonedTimeToUtc, isSlotTooLate, isTooLateToModify, todayInZone, isInPast } from '../../../../src/utils/hutTime.js';

describe('hutTime - Black-Box Tests', () => {

  describe('zonedTimeToUtc', () => {
    
    it('should correctly convert time during Daylight Saving Time (CEST, UTC+2) to UTC', () => {
      // August 14, 2026, at 13:00 in Rome -> During summer Rome is UTC+2, so 13:00 local = 11:00 UTC
      const result = zonedTimeToUtc('2026-08-14', '13:00', 'Europe/Rome');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2026-08-14T11:00:00.000Z');
    });

    it('should correctly convert time during Standard Time (CET, UTC+1) to UTC', () => {
      // January 15, 2026, at 13:00 in Rome -> During winter Rome is UTC+1, so 13:00 local = 12:00 UTC
      const result = zonedTimeToUtc('2026-01-15', '13:00', 'Europe/Rome');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2026-01-15T12:00:00.000Z');
    });

    it('should reuse the formatter cache correctly for repeated calls with the same timezone', () => {
      const res1 = zonedTimeToUtc('2026-08-14', '13:00', 'Europe/Rome');
      const res2 = zonedTimeToUtc('2026-08-14', '14:00', 'Europe/Rome');
      expect(res1.toISOString()).toBe('2026-08-14T11:00:00.000Z');
      expect(res2.toISOString()).toBe('2026-08-14T12:00:00.000Z');
    });

  });

  describe('isSlotTooLate', () => {
    
    const slot = {
      date: '2026-08-14',
      start_time: '13:00'
    };
    const timeZone = 'Europe/Rome';
    // Slot set for 13:00 local time (11:00 UTC).
    // The cutoff threshold for booking (2 hours prior) corresponds to 11:00 local time (09:00 UTC).

    it('should return false when checking well before the 2-hour threshold (e.g., 2 hours and 1 minute before)', () => {
      // 2 hours and 1 minute before 13:00 local = 10:59 local time (08:59:00 UTC)
      const now = new Date('2026-08-14T08:59:00.000Z');
      
      const result = isSlotTooLate(slot, { timeZone, now });
      expect(result).toBe(false);
    });

    it('should return true when checking past the threshold (e.g., 1 hour and 59 minutes before)', () => {
      // 1 hour and 59 minutes before 13:00 local = 11:01 local time (09:01:00 UTC)
      const now = new Date('2026-08-14T09:01:00.000Z');
      
      const result = isSlotTooLate(slot, { timeZone, now });
      expect(result).toBe(true);
    });

    it('should respect a custom lead time (leadMs) when passed as an optional parameter', () => {
      // Set a custom lead time of 4 hours instead of 2 (4 hours before 13:00 = 09:00 local / 07:00 UTC)
      const customLeadMs = 4 * 60 * 60 * 1000; 
      
      const now = new Date('2026-08-14T07:01:00.000Z');
      
      const result = isSlotTooLate(slot, { timeZone, now, leadMs: customLeadMs });
      expect(result).toBe(true);
    });

  });

  describe('isTooLateToModify (MH-06 48-hour rule)', () => {
    
    it('should return true if less than 48 hours remain before the slot starts', () => {
      // Slot on August 14, 2026, at 13:00 local
      const slot = { date: '2026-08-14', start_time: '13:00' };
      // Current time: August 12, 2026, at 14:00 UTC (less than 48h remaining)
      const now = new Date('2026-08-12T14:00:00.000Z');

      const result = isTooLateToModify(slot, { timeZone: 'Europe/Rome', now });
      expect(result).toBe(true);
    });

    it('should return false if more than 48 hours remain before the slot starts', () => {
      const slot = { date: '2026-08-14', start_time: '13:00' };
      // Current time: August 10, 2026, at 10:00 UTC (plenty of time)
      const now = new Date('2026-08-10T10:00:00.000Z');

      const result = isTooLateToModify(slot, { timeZone: 'Europe/Rome', now });
      expect(result).toBe(false);
    });

  });

  describe('todayInZone', () => {
    it('should correctly return today date as YYYY-MM-DD in the specified time zone', () => {
      // Fixed UTC instant corresponding to August 14, 2026, at 23:30 UTC
      // In Europe/Rome (UTC+2 in summer), this is already August 15, 2026, at 01:30 local time
      const now = new Date('2026-08-14T23:30:00.000Z');
      const result = todayInZone('Europe/Rome', now);
      expect(result).toBe('2026-08-15');
    });
  });

  describe('isInPast', () => {
    it('should return true if the given wall-clock date/time is already in the past', () => {
      const date = '2026-08-14';
      const time = '10:00';
      const timeZone = 'Europe/Rome';
      
      // Current time set to 10:01 local time (08:01:00 UTC) -> target time is in the past
      const now = new Date('2026-08-14T08:01:00.000Z');

      const result = isInPast(date, time, { timeZone, now });
      expect(result).toBe(true);
    });

    it('should return false if the given wall-clock date/time is still in the future', () => {
      const date = '2026-08-14';
      const time = '10:00';
      const timeZone = 'Europe/Rome';
      
      // Current time set to 09:59 local time (07:59:00 UTC) -> target time is in the future
      const now = new Date('2026-08-14T07:59:00.000Z');

      const result = isInPast(date, time, { timeZone, now });
      expect(result).toBe(false);
    });
  });

});