import { describe, it, expect } from 'vitest';
import { computeSeating, canSeat } from '../../../src/services/seating.js'; // Sostituisci con il percorso corretto

describe('seating - Black-Box Tests', () => {

  describe('canSeat', () => {
    
    it('should return true if total free seats from table rows can cover the party size', () => {
      const tableRows = [
        { id: 1, label: 'T1', seats: 4, free: 4 },
        { id: 2, label: 'T2', seats: 2, free: 2 },
      ];
      // Total free = 6, party size = 5 -> true
      expect(canSeat(5, tableRows)).toBe(true);
    });

    it('should return false if total free seats are insufficient', () => {
      const tableRows = [
        { id: 1, label: 'T1', seats: 4, free: 2 },
      ];
      // Total free = 2, party size = 3 -> false
      expect(canSeat(3, tableRows)).toBe(false);
    });

    it('should handle empty or null table rows safely', () => {
      expect(canSeat(2, [])).toBe(false);
      expect(canSeat(2, null)).toBe(false);
    });

  });

  describe('computeSeating', () => {

    it('should return null if no valid seating arrangement exists (insufficient seats)', () => {
      const tableRows = [
        { id: 1, label: 'T1', seats: 2, free: 1 },
      ];
      const result = computeSeating(3, tableRows);
      expect(result).toBeNull();
    });

    it('should return a single table fit arrangement when a table fully accommodates the party', () => {
      const tableRows = [
        { id: 1, label: 'T1', seats: 2, free: 2 },
        { id: 2, label: 'T2', seats: 6, free: 6 },
      ];
      // Party of 4 fits perfectly into T2 (which has 6 free seats)
      const result = computeSeating(4, tableRows);

      expect(result).not.toBeNull();
      expect(result.fit).toBe('single_table');
      expect(result.assignments).toEqual([
        { tableId: 2, tableLabel: 'T2', seats: 4 }
      ]);
      expect(result.explanation).toBeDefined();
    });

    it('should return a split fit arrangement when the party must be divided across multiple tables', () => {
      const tableRows = [
        { id: 1, label: 'T1', seats: 3, free: 3 },
        { id: 2, label: 'T2', seats: 3, free: 3 },
      ];
      // Party of 4 exceeds single table capacity (max free is 3), requires split
      const result = computeSeating(4, tableRows);

      expect(result).not.toBeNull();
      expect(result.fit).toBe('split');
      expect(result.assignments.length).toBe(2);
      expect(result.assignments).toEqual([
        { tableId: 1, tableLabel: 'T1', seats: 3 },
        { tableId: 2, tableLabel: 'T2', seats: 1 },
      ]);
      expect(result.explanation).toBeDefined();
    });

  });

});