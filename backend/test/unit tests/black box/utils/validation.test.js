import { describe, it, expect } from 'vitest';
import {
  isMissing,
  isPositiveInt,
  parsePositiveInt,
  isValidDate,
  isValidTime,
  isValidEmail,
} from '../../../../src/utils/validation.js';

describe('Validation Utils - Black-Box Tests', () => {

  describe('isMissing', () => {
    it('should identify missing or empty values correctly', () => {
      expect(isMissing(undefined)).toBe(true);
      expect(isMissing(null)).toBe(true);
      expect(isMissing('')).toBe(true);
      expect(isMissing(0)).toBe(false);
      expect(isMissing(false)).toBe(false);
      expect(isMissing('hello')).toBe(false);
    });
  });

  describe('isPositiveInt', () => {
    it('should accept only valid positive numbers', () => {
      expect(isPositiveInt(1)).toBe(true);
      expect(isPositiveInt(100)).toBe(true);
      expect(isPositiveInt(0)).toBe(false);
      expect(isPositiveInt(-5)).toBe(false);
      expect(isPositiveInt(3.14)).toBe(false);
      expect(isPositiveInt('5')).toBe(false);
    });
  });

  describe('parsePositiveInt', () => {
    it('should parse positive integers from numbers or numeric strings', () => {
      expect(parsePositiveInt(42)).toBe(42);
      expect(parsePositiveInt('42')).toBe(42);
      expect(parsePositiveInt('   15   ')).toBe(15);
      expect(parsePositiveInt(0)).toBeNull();
      expect(parsePositiveInt('-10')).toBeNull();
      expect(parsePositiveInt('abc')).toBeNull();
      expect(parsePositiveInt(null)).toBeNull();
    });
  });

  describe('isValidDate', () => {
    it('should validate standard YYYY-MM-DD date strings', () => {
      expect(isValidDate('2026-08-14')).toBe(true);
      expect(isValidDate('2024-02-29')).toBe(true);
      expect(isValidDate('2026-02-31')).toBe(false);
      expect(isValidDate('26-08-14')).toBe(false);
      expect(isValidDate('2026/08/14')).toBe(false);
      expect(isValidDate(null)).toBe(false);
    });
  });

  describe('isValidTime', () => {
    it('should validate HH:MM time strings format and ranges', () => {
      expect(isValidTime('00:00')).toBe(true);
      expect(isValidTime('12:30')).toBe(true);
      expect(isValidTime('23:59')).toBe(true);
      expect(isValidTime('24:00')).toBe(false);
      expect(isValidTime('12:60')).toBe(false);
      expect(isValidTime('9:30')).toBe(false);
      expect(isValidTime(null)).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should validate email structure correctness', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('name.surname@sub.domain.org')).toBe(true);
      expect(isValidEmail('plain-string')).toBe(false);
      expect(isValidEmail('missing-domain@')).toBe(false);
      expect(isValidEmail('@missing-user.com')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });
  });

});