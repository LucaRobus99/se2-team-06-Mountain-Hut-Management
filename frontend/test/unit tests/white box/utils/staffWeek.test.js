import { describe, it, expect } from 'vitest';
import { addDays, mondayOf, weekRange } from '../../../../src/utils/staffWeek.js';

describe('staffWeek - White-Box Tests', () => {
  describe('addDays', () => {
    it('should add positive and negative day offsets using UTC date arithmetic', () => {
      expect(addDays('2026-11-09', 6)).toBe('2026-11-15');
      expect(addDays('2026-11-15', -6)).toBe('2026-11-09');
      expect(addDays('2026-11-15', 0)).toBe('2026-11-15');
    });

    it('should handle month, year, and leap-year boundaries cleanly', () => {
      expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
      expect(addDays('2026-12-30', 5)).toBe('2027-01-04');
      expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
      expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    });
  });

  describe('mondayOf', () => {
    it('should return an empty string for falsy or empty input', () => {
      expect(mondayOf('')).toBe('');
      expect(mondayOf(null)).toBe('');
      expect(mondayOf(undefined)).toBe('');
    });

    it('should return the same date when input is already a Monday', () => {
      expect(mondayOf('2026-11-09')).toBe('2026-11-09');
    });

    it('should map any weekday (Tuesday through Sunday) back to its Monday', () => {
      // Tuesday -> -1 day
      expect(mondayOf('2026-11-10')).toBe('2026-11-09');
      // Wednesday -> -2 days
      expect(mondayOf('2026-11-11')).toBe('2026-11-09');
      // Friday -> -4 days
      expect(mondayOf('2026-11-13')).toBe('2026-11-09');
      // Sunday (getUTCDay() === 0) -> -6 days
      expect(mondayOf('2026-11-15')).toBe('2026-11-09');
    });
  });

  describe('weekRange', () => {
    it('should format a 7-day range within the same month', () => {
      expect(weekRange('2026-11-09')).toBe('9 Nov 2026 – 15 Nov 2026');
    });

    it('should format a 7-day range spanning across month and year boundaries', () => {
      expect(weekRange('2026-11-30')).toBe('30 Nov 2026 – 6 Dec 2026');
      expect(weekRange('2026-12-28')).toBe('28 Dec 2026 – 3 Jan 2027');
    });
  });
});