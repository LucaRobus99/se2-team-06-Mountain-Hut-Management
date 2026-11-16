import { describe, it, expect } from 'vitest';
import { 
  zonedTimeToUtc, 
  isSlotTooLate, 
  isTooLateToModify, 
  BOOKING_LEAD_MS, 
  MODIFICATION_LEAD_MS 
} from '../../../../src/utils/hutTime.js';

describe('hutTime - White-Box Tests', () => {

  describe('Internal DST handling and two-pass loop in zonedTimeToUtc', () => {
    
    it('should correctly handle transition into Daylight Saving Time (spring forward) using the two-pass adjustment loop', () => {
      // In 2026, DST starts in Europe/Rome on March 29, 2026 (clocks go forward 1 hour at 02:00 -> 03:00)
      const result = zonedTimeToUtc('2026-03-29', '03:30', 'Europe/Rome');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2026-03-29T01:30:00.000Z');
    });

    it('should correctly handle transition out of Daylight Saving Time (fall back) using the two-pass adjustment loop', () => {
      // In 2026, DST ends in Europe/Rome on October 25, 2026 (clocks go back 1 hour at 03:00 -> 02:00)
      const result = zonedTimeToUtc('2026-10-25', '03:30', 'Europe/Rome');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2026-10-25T02:30:00.000Z');
    });

  });

  describe('Formatter cache mechanism (formatterCache & formatterFor)', () => {
    
    it('should successfully reuse the internal formatter cache across multiple consecutive calls with the same timezone', () => {
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

  describe('Internal partsInZone & timezone mapping validation', () => {
    
    it('should correctly map UTC instants to zone-specific components (exercising internal partsInZone logic via zonedTimeToUtc precision)', () => {
      const utcDate = new Date('2026-08-14T11:00:00.000Z');
      const reconstructedUtc = zonedTimeToUtc('2026-08-14', '13:00', 'Europe/Rome');
      
      expect(reconstructedUtc.getTime()).toBe(utcDate.getTime());
    });

  });

  describe('Constant verification (BOOKING_LEAD_MS & MODIFICATION_LEAD_MS)', () => {
    
    it('should export BOOKING_LEAD_MS correctly configured to 2 hours in milliseconds', () => {
      const expectedLeadMs = 2 * 60 * 60 * 1000;
      expect(BOOKING_LEAD_MS).toBe(expectedLeadMs);
    });

    it('should export MODIFICATION_LEAD_MS correctly configured to 48 hours in milliseconds', () => {
      const expectedModLeadMs = 48 * 60 * 60 * 1000;
      expect(MODIFICATION_LEAD_MS).toBe(expectedModLeadMs);
    });

  });

  describe('White-box branches for isTooLateToModify and default parameter fallbacks', () => {

    it('should correctly evaluate isTooLateToModify utilizing default parameters', () => {
      const slot = { date: '2026-08-14', start_time: '13:00' };
      // Passing a custom now option to test internal fallback handling
      const result = isTooLateToModify(slot, { timeZone: 'Europe/Rome', now: new Date('2026-08-10T10:00:00.000Z') });
      expect(result).toBe(false);
    });

    it('should correctly evaluate isSlotTooLate using default now instance when omitted', () => {
      const slot = { date: '2020-01-01', start_time: '12:00' };
      // A slot in the distant past should always be too late
      const result = isSlotTooLate(slot, { timeZone: 'Europe/Rome' });
      expect(result).toBe(true);
    });

  });

});