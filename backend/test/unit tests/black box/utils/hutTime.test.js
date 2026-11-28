import { describe, it, expect } from 'vitest';
import {
  zonedTimeToUtc,
  isSlotTooLate,
  isTooLateToModify,
  todayInZone,
  isInPast,
  BOOKING_LEAD_MS,
  MODIFICATION_LEAD_MS,
} from '../../../../src/utils/hutTime.js';

describe('hutTime - Black-Box Tests', () => {
  describe('zonedTimeToUtc', () => {
    it('should correctly convert time during Daylight Saving Time (CEST, UTC+2) to UTC', () => {
      const result = zonedTimeToUtc('2026-08-14', '13:00', 'Europe/Rome');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2026-08-14T11:00:00.000Z');
    });

    it('should correctly convert time during Standard Time (CET, UTC+1) to UTC', () => {
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

    it('should handle DST transition days accurately', () => {
      // Spring forward in Europe/Rome: 2026-03-29 (02:00 jumps to 03:00, CEST = UTC+2)
      const springResult = zonedTimeToUtc('2026-03-29', '10:00', 'Europe/Rome');
      expect(springResult.toISOString()).toBe('2026-03-29T08:00:00.000Z');

      // Fall back in Europe/Rome: 2026-10-25 (03:00 drops back to 02:00, CET = UTC+1)
      const autumnResult = zonedTimeToUtc('2026-10-25', '10:00', 'Europe/Rome');
      expect(autumnResult.toISOString()).toBe('2026-10-25T09:00:00.000Z');
    });
  });

  describe('isSlotTooLate', () => {
    const slot = {
      date: '2026-08-14',
      start_time: '13:00',
    };
    const timeZone = 'Europe/Rome';

    it('should return false when checking well before the 2-hour threshold (e.g., 2 hours and 1 minute before)', () => {
      const now = new Date('2026-08-14T08:59:00.000Z');
      const result = isSlotTooLate(slot, { timeZone, now });
      expect(result).toBe(false);
    });

    it('should return false at the exact 2-hour boundary (11:00 local = 09:00 UTC)', () => {
      const now = new Date('2026-08-14T09:00:00.000Z');
      const result = isSlotTooLate(slot, { timeZone, now });
      expect(result).toBe(false);
    });

    it('should return true when checking past the threshold (e.g., 1 hour and 59 minutes before)', () => {
      const now = new Date('2026-08-14T09:01:00.000Z');
      const result = isSlotTooLate(slot, { timeZone, now });
      expect(result).toBe(true);
    });

    it('should respect a custom lead time (leadMs) when passed as an optional parameter', () => {
      const customLeadMs = 4 * 60 * 60 * 1000;
      const now = new Date('2026-08-14T07:01:00.000Z');
      const result = isSlotTooLate(slot, { timeZone, now, leadMs: customLeadMs });
      expect(result).toBe(true);
    });

    it('should work when optional leadMs is omitted', () => {
      const now = new Date(Date.now() - (BOOKING_LEAD_MS + 60_000));
      const dynamicSlot = {
        date: todayInZone(timeZone, now),
        start_time: '23:59',
      };
      expect(typeof isSlotTooLate(dynamicSlot, { timeZone, now })).toBe('boolean');
    });
  });

  describe('isTooLateToModify (MH-06 48-hour rule)', () => {
    it('should return true if less than 48 hours remain before the slot starts', () => {
      const slot = { date: '2026-08-14', start_time: '13:00' };
      const now = new Date('2026-08-12T14:00:00.000Z');

      const result = isTooLateToModify(slot, { timeZone: 'Europe/Rome', now });
      expect(result).toBe(true);
    });

    it('should return false at the exact 48-hour boundary', () => {
      const slot = { date: '2026-08-14', start_time: '13:00' }; // 11:00 UTC on Aug 14
      const now = new Date('2026-08-12T11:00:00.000Z');

      const result = isTooLateToModify(slot, { timeZone: 'Europe/Rome', now });
      expect(result).toBe(false);
    });

    it('should return false if more than 48 hours remain before the slot starts', () => {
      const slot = { date: '2026-08-14', start_time: '13:00' };
      const now = new Date('2026-08-10T10:00:00.000Z');

      const result = isTooLateToModify(slot, { timeZone: 'Europe/Rome', now });
      expect(result).toBe(false);
    });

    it('should respect a custom leadMs for modification checks', () => {
      const slot = { date: '2026-08-14', start_time: '13:00' };
      const now = new Date('2026-08-14T08:00:00.000Z'); // 3h before 11:00 UTC
      expect(isTooLateToModify(slot, { timeZone: 'Europe/Rome', now, leadMs: MODIFICATION_LEAD_MS })).toBe(true);
      expect(isTooLateToModify(slot, { timeZone: 'Europe/Rome', now, leadMs: 60 * 60 * 1000 })).toBe(false);
    });
  });

  describe('todayInZone', () => {
    it('should correctly return today date as YYYY-MM-DD in the specified time zone', () => {
      const now = new Date('2026-08-14T23:30:00.000Z');
      const result = todayInZone('Europe/Rome', now);
      expect(result).toBe('2026-08-15');
    });

    it('should zero-pad single-digit months and days', () => {
      const now = new Date('2026-03-05T10:00:00.000Z');
      expect(todayInZone('Europe/Rome', now)).toBe('2026-03-05');
    });

    it('should return a valid YYYY-MM-DD string when now is omitted', () => {
      const result = todayInZone('Europe/Rome');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('isInPast', () => {
    it('should return true if the given wall-clock date/time is already in the past', () => {
      const date = '2026-08-14';
      const time = '10:00';
      const timeZone = 'Europe/Rome';
      const now = new Date('2026-08-14T08:01:00.000Z');

      const result = isInPast(date, time, { timeZone, now });
      expect(result).toBe(true);
    });

    it('should return true when the target wall-clock time equals now', () => {
      const result = isInPast('2026-08-14', '10:00', {
        timeZone: 'Europe/Rome',
        now: new Date('2026-08-14T08:00:00.000Z'),
      });
      expect(result).toBe(true);
    });

    it('should return false if the given wall-clock date/time is still in the future', () => {
      const date = '2026-08-14';
      const time = '10:00';
      const timeZone = 'Europe/Rome';
      const now = new Date('2026-08-14T07:59:00.000Z');

      const result = isInPast(date, time, { timeZone, now });
      expect(result).toBe(false);
    });

    it('should work when now is omitted', () => {
      expect(isInPast('2000-01-01', '12:00', { timeZone: 'Europe/Rome' })).toBe(true);
    });
  });
});