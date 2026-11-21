import { describe, it, expect } from 'vitest';
import { parseRequirements, MAX_REQUIREMENT_LENGTH } from '../../../../src/services/requirements.js';

describe('requirements - White-Box Tests', () => {

  describe('Entry Structure and Type Validation Branches', () => {
    it('should reject entries that are not valid objects (e.g., null, primitive values, arrays inside array)', () => {
      const details = [];
      const input = [
        null,
        'primitive-string',
        [1, 2, 3], // Array inside array
      ];

      const result = parseRequirements(input, details);

      expect(result).toEqual([]);
      expect(details).toHaveLength(3);
      details.forEach((d) => {
        expect(d).toMatchObject({ field: 'requirements', rule: 'invalid' });
      });
    });
  });

  describe('Description Validation Branches (trim, empty, max length)', () => {
    it('should reject descriptions that are empty string or only whitespace after trimming', () => {
      const details = [];
      const input = [
        { description: '', allergies: false },
        { description: '   ', allergies: true },
        { description: null, allergies: false }, // Non-string description falls back to ''
      ];

      const result = parseRequirements(input, details);

      expect(result).toEqual([]);
      expect(details.length).toBeGreaterThanOrEqual(3);
      expect(details.some((d) => d.rule === 'invalid')).toBe(true);
    });

    it('should reject descriptions exceeding MAX_REQUIREMENT_LENGTH', () => {
      const details = [];
      const tooLongDesc = 'a'.repeat(MAX_REQUIREMENT_LENGTH + 1);
      const input = [
        { description: tooLongDesc, allergies: false }
      ];

      const result = parseRequirements(input, details);

      expect(result).toEqual([]);
      expect(details).toHaveLength(1);
      expect(details[0]).toMatchObject({ field: 'requirements', rule: 'too_long' });
    });
  });

  describe('Allergies Flag Validation Branches', () => {
    it('should reject entries where allergies property is missing or not a boolean', () => {
      const details = [];
      const input = [
        { description: 'Gluten free', allergies: 'true' }, // String instead of boolean
        { description: 'Lactose intolerant' },             // Missing allergies property (undefined)
      ];

      const result = parseRequirements(input, details);

      expect(result).toEqual([]);
      expect(details).toHaveLength(2);
      details.forEach((d) => {
        expect(d).toMatchObject({ field: 'requirements', rule: 'invalid' });
      });
    });
  });

});