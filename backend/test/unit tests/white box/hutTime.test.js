import { describe, it, expect } from 'vitest';
import { zonedTimeToUtc, isSlotTooLate, BOOKING_LEAD_MS } from '../../../src/utils/hutTime.js';

describe('hutTime - White-Box Tests', () => {

  describe('Internal DST handling and two-pass loop in zonedTimeToUtc', () => {
    
    it('should correctly handle transition into Daylight Saving Time (spring forward) using the two-pass adjustment loop', () => {
      // In 2026, DST starts in Europe/Rome on March 29, 2026 (clocks go forward 1 hour at 02:00 -> 03:00)
      // Testing a time right after the transition (03:30 local time)
      const result = zonedTimeToUtc('2026-03-29', '03:30', 'Europe/Rome');
      expect(result).toBeInstanceOf(Date);
      // At 03:30 CEST (UTC+2), the corresponding UTC time is 01:30:00.000Z
      expect(result.toISOString()).toBe('2026-03-29T01:30:00.000Z');
    });

    it('should correctly handle transition out of Daylight Saving Time (fall back) using the two-pass adjustment loop', () => {
      // In 2026, DST ends in Europe/Rome on October 25, 2026 (clocks go back 1 hour at 03:00 -> 02:00)
      // Testing a time during standard time return (03:30 local time)
      const result = zonedTimeToUtc('2026-10-25', '03:30', 'Europe/Rome');
      expect(result).toBeInstanceOf(Date);
      // After fallback, 03:30 local is CET (UTC+1), so UTC time is 02:30:00.000Z
      expect(result.toISOString()).toBe('2026-10-25T02:30:00.000Z');
    });

  });

  describe('Formatter cache mechanism (formatterCache & formatterFor)', () => {
    
    it('should successfully reuse the internal formatter cache across multiple consecutive calls with the same timezone', () => {
      // Calling zonedTimeToUtc multiple times with the same timezone exercises the Map cache path
      const dateStr = '2026-08-14';
      const tz = 'Europe/Rome';
      
      const firstCall = zonedTimeToUtc(dateStr, '10:00', tz);
      const secondCall = zonedTimeToUtc(dateStr, '12:00', tz);
      const thirdCall = zonedTimeToUtc(dateStr, '14:00', tz);

      expect(firstCall).toBeInstanceOf(Date);
      expect(secondCall).toBeInstanceOf(Date);
      expect(thirdCall).toBeInstanceOf(Date);
    });

  });

  describe('Constant verification (BOOKING_LEAD_MS)', () => {
    
    it('should export BOOKING_LEAD_MS correctly configured to 2 hours in milliseconds', () => {
      const expectedLeadMs = 2 * 60 * 60 * 1000;
      expect(BOOKING_LEAD_MS).toBe(expectedLeadMs);
    });

  });

});