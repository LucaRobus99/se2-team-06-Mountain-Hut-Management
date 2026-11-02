import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleTableAllocator } from '../../../src/services/SimpleTableAllocator.js'; // Sostituisci con il percorso corretto

describe('SimpleTableAllocator - Black-Box Tests', () => {
  let allocator;

  beforeEach(() => {
    allocator = new SimpleTableAllocator();
  });

  describe('canSeat', () => {
    
    it('should return true if total free seats are enough for the party size', () => {
      const tables = [
        { id: 1, label: 'T1', capacity: 4, occupied: 0 }, // 4 free
        { id: 2, label: 'T2', capacity: 2, occupied: 0 }, // 2 free
      ];
      // Total free = 6, party size = 5
      expect(allocator.canSeat(5, tables)).toBe(true);
    });

    it('should return false if total free seats are less than the party size', () => {
      const tables = [
        { id: 1, label: 'T1', capacity: 4, occupied: 2 }, // 2 free
      ];
      // Total free = 2, party size = 3
      expect(allocator.canSeat(3, tables)).toBe(false);
    });

    it('should return false for invalid party sizes (e.g., zero, negative, or non-integer)', () => {
      const tables = [{ id: 1, label: 'T1', capacity: 4, occupied: 0 }];
      expect(allocator.canSeat(0, tables)).toBe(false);
      expect(allocator.canSeat(-2, tables)).toBe(false);
      expect(allocator.canSeat(2.5, tables)).toBe(false);
    });

  });

  describe('allocate', () => {

    it('should return a failure object if party size is invalid', () => {
      const tables = [{ id: 1, label: 'T1', capacity: 4, occupied: 0 }];
      const result = allocator.allocate({ size: 0 }, tables);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('INVALID_PARTY_SIZE');
    });

    it('should return a failure object if tables array is empty or missing', () => {
      const result = allocator.allocate({ size: 2 }, []);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('NO_TABLES');
    });

    it('should return a failure code INSUFFICIENT_SEATS if free seats cannot cover the party', () => {
      const tables = [{ id: 1, label: 'T1', capacity: 2, occupied: 2 }]; // 0 free
      const result = allocator.allocate({ size: 2 }, tables);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('INSUFFICIENT_SEATS');
    });

    it('should successfully allocate a single table without splitting when it fits perfectly (Step 1)', () => {
      const tables = [
        { id: 1, label: 'T1', capacity: 2, occupied: 0 }, // 2 free (too small)
        { id: 2, label: 'T2', capacity: 6, occupied: 1 }, // 5 free (fits party of 4)
      ];
      const result = allocator.allocate({ size: 4 }, tables);

      expect(result.ok).toBe(true);
      expect(result.split).toBe(false);
      expect(result.step).toBe(1);
      expect(result.assignments).toEqual([
        { tableId: 2, tableLabel: 'T2', guests: 4 }
      ]);
      expect(result.score).toEqual({ tablesUsed: 1, wastedSeats: 1 }); // 5 free - 4 guests = 1 wasted
    });

    it('should successfully split the party across multiple tables when no single table fits (Step 2)', () => {
      const tables = [
        { id: 1, label: 'T1', capacity: 3, occupied: 0 }, // 3 free
        { id: 2, label: 'T2', capacity: 3, occupied: 0 }, // 3 free
      ];
      // Party of 5 needs a split because max single table free is 3
      const result = allocator.allocate({ size: 5 }, tables);

      expect(result.ok).toBe(true);
      expect(result.split).toBe(true);
      expect(result.step).toBe(2);
      expect(result.assignments.length).toBe(2);
      // Total free = 6, size = 5, wasted seats = 6 - 5 = 1
      expect(result.score).toEqual({ tablesUsed: 2, wastedSeats: 1 });
    });

  });

});