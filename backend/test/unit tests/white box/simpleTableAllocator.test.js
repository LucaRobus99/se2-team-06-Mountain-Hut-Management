import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleTableAllocator } from '../../../src/services/SimpleTableAllocator.js';

describe('SimpleTableAllocator - White-Box Tests', () => {
  let allocator;

  beforeEach(() => {
    allocator = new SimpleTableAllocator();
  });

  describe('Internal Normalization Branches (normalise)', () => {
    
    it('should throw a TypeError if a table has a negative capacity', () => {
      const tables = [
        { id: 1, label: 'T1', capacity: -4, occupied: 0 }
      ];
      
      expect(() => allocator.allocate({ size: 2 }, tables)).toThrow(TypeError);
    });

    it('should throw a TypeError if a table has a non-integer capacity or occupied value', () => {
      const tables = [
        { id: 1, label: 'T1', capacity: 4.5, occupied: 0 }
      ];

      expect(() => allocator.allocate({ size: 2 }, tables)).toThrow(TypeError);
    });

    it('should default label to string representation of id if label is missing', () => {
      const tables = [
        { id: 10, capacity: 4, occupied: 0 } // No label provided
      ];
      const result = allocator.allocate({ size: 2 }, tables);

      expect(result.ok).toBe(true);
      // Verify via assignments or internal structure that the label defaulted correctly
      expect(result.assignments[0].tableLabel).toBe('10');
    });

  });

  describe('Internal Knapsack Tie-Breaking & Preferred Logic (preferred)', () => {
    
    it('should prefer tables with lower IDs when multiple combinations share the exact same seat count and waste', () => {
      // Two tables with same free seats (capacity 4, occupied 0 -> 4 free) but different IDs
      const tables = [
        { id: 2, label: 'T2', capacity: 4, occupied: 0 },
        { id: 1, label: 'T1', capacity: 4, occupied: 0 },
      ];
      // Party of 4 can fit in T1 or T2. Since T1 has a lower ID, the preferred logic should choose T1.
      const result = allocator.allocate({ size: 4 }, tables);

      expect(result.ok).toBe(true);
      expect(result.assignments[0].tableId).toBe(1);
    });

    it('should prefer the set with fewer total seats (smaller table) when free seats are identical', () => {
      const tables = [
        { id: 1, label: 'T1', capacity: 10, occupied: 6 }, // 4 free, 10 total capacity
        { id: 2, label: 'T2', capacity: 5, occupied: 1 },  // 4 free, 5 total capacity
      ];
      // Both tables offer 4 free seats for a party of 4.
      // Rule 3 states: prefer smaller total capacity (fewer seats in total) -> T2 (capacity 5 vs 10).
      const result = allocator.allocate({ size: 4 }, tables);

      expect(result.ok).toBe(true);
      expect(result.assignments[0].tableId).toBe(2);
    });

  });

  describe('Internal Seating Distribution Logic (seat)', () => {
    
    it('should allocate entirely to the single largest table if it fits the party without splitting', () => {
      const tables = [
        { id: 1, label: 'T1', capacity: 2, occupied: 0 }, // 2 free
        { id: 2, label: 'T2', capacity: 6, occupied: 0 }, // 6 free
      ];
      // Party of 5 fits entirely into T2 (capacity 6), so no split should occur.
      const result = allocator.allocate({ size: 5 }, tables);

      expect(result.ok).toBe(true);
      expect(result.split).toBe(false); // No split needed!
      expect(result.assignments).toEqual([
        { tableId: 2, tableLabel: 'T2', guests: 5 }
      ]);
    });

    it('should correctly split across multiple tables respecting table ID order', () => {
      const tables = [
        { id: 1, label: 'T1', capacity: 3, occupied: 0 }, // 3 free
        { id: 2, label: 'T2', capacity: 3, occupied: 0 }, // 3 free
      ];
      // Party of 4 -> T1 (lower ID) takes 3, T2 takes the remaining 1
      const result = allocator.allocate({ size: 4 }, tables);

      expect(result.ok).toBe(true);
      expect(result.split).toBe(true);
      expect(result.assignments).toEqual([
        { tableId: 1, tableLabel: 'T1', guests: 3 },
        { tableId: 2, tableLabel: 'T2', guests: 1 },
      ]);
    });

  });

});