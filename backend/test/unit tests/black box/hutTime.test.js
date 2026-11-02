import { describe, it, expect } from 'vitest';
import { zonedTimeToUtc, isSlotTooLate } from '../../../src/utils/hutTime.js'; // Replace with the actual file path

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
      
      // Simulate current time at 09:01 local (07:01 UTC), within the 4-hour window -> too late for custom lead rule
      const now = new Date('2026-08-14T07:01:00.000Z');
      
      const result = isSlotTooLate(slot, { timeZone, now, leadMs: customLeadMs });
      expect(result).toBe(true);
    });

  });

});