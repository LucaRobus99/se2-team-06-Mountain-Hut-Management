import { describe, it, expect } from 'vitest';
import { parseRequirements, MAX_REQUIREMENT_LENGTH } from '../../../../src/services/requirements.js';

describe('requirements - Black-Box Tests', () => {

  describe('Absence and Empty List Handling', () => {
    it('should return null if requirements value is missing (undefined or null)', () => {
      const details = [];
      const resultNull = parseRequirements(null, details);
      const resultUndefined = parseRequirements(undefined, details);

      expect(resultNull).toBeNull();
      expect(resultUndefined).toBeNull();
      expect(details).toHaveLength(0);
    });

    it('should return an empty array if requirements is passed as an empty array', () => {
      const details = [];
      const result = parseRequirements([], details);

      expect(result).toEqual([]);
      expect(details).toHaveLength(0);
    });
  });

  describe('Valid Requirements Processing', () => {
    it('should successfully parse and trim valid requirements list with correct boolean allergies flags', () => {
      const details = [];
      const input = [
        { description: '   Severe peanut allergy   ', allergies: true },
        { description: 'Vegetarian meal preferred', allergies: false },
      ];

      const result = parseRequirements(input, details);

      expect(details).toHaveLength(0);
      expect(result).toEqual([
        { description: 'Severe peanut allergy', allergies: true },
        { description: 'Vegetarian meal preferred', allergies: false },
      ]);
    });
  });

  describe('Invalid Payload Structures and Types', () => {
    it('should push validation error into details and return null if requirements is not an array', () => {
      const details = [];
      const result = parseRequirements('not-an-array', details);

      expect(result).toBeNull();
      expect(details).toHaveLength(1);
      expect(details[0]).toMatchObject({ field: 'requirements', rule: 'invalid' });
    });
  });

});