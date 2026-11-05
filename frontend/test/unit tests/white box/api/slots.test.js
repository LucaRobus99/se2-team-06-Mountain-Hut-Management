import { describe, it, expect, beforeEach, vi } from 'vitest';
import { todayInHut, mealLabel, listStaffSlots, createStaffSlot } from '../../../../src/api/slots.js';

describe('Slot API - White-Box Unit Tests', () => {

  beforeEach(() => {
    // Clear all mocks before each test
    vi.restoreAllMocks();
  });

  describe('todayInHut', () => {
    it('should return a date string in YYYY-MM-DD format', () => {
      const dateStr = todayInHut();
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('mealLabel', () => {
    it('should return the correct capitalized label for known meals', () => {
      expect(mealLabel('breakfast')).toBe('Breakfast');
      expect(mealLabel('lunch')).toBe('Lunch');
      expect(mealLabel('aperitivo')).toBe('Aperitivo');
      expect(mealLabel('dinner')).toBe('Dinner');
    });

    it('should return the original string if meal is unknown', () => {
      expect(mealLabel('brunch')).toBe('brunch');
    });
  });

  describe('listStaffSlots', () => {
    it('should successfully fetch staff slots for a given date', async () => {
      const mockSlots = [{ id: 1, date: '2026-11-20', meal: 'lunch' }];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSlots
      }));

      const result = await listStaffSlots('2026-11-20');

      expect(result).toEqual(mockSlots);
      expect(fetch).toHaveBeenCalledWith(
        '/api/slots?date=2026-11-20',
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('should throw connection error if fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));

      await expect(listStaffSlots('2026-11-20'))
        .rejects.toThrow('Cannot connect to the hut server. Please try again.');
    });

    it('should throw server error when response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { code: 'FORBIDDEN', message: 'Staff only' } })
      }));

      await expect(listStaffSlots('2026-11-20'))
        .rejects.toThrow('Staff only');
    });
  });

  describe('createStaffSlot', () => {
    it('should successfully create a slot using explicit tables configuration', async () => {
      const mockCreatedSlot = { id: 5, date: '2026-11-20', meal: 'dinner' };
      const payload = {
        date: '2026-11-20',
        meal: 'dinner',
        startTime: '19:00',
        endTime: '21:00',
        tables: [{ id: 1, capacity: 4 }]
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockCreatedSlot
      }));

      const result = await createStaffSlot(payload);

      expect(result).toEqual(mockCreatedSlot);
      expect(fetch).toHaveBeenCalledWith(
        '/api/slots',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      );
    });

    it('should successfully create a slot copying tables from another slot ID', async () => {
      const mockCreatedSlot = { id: 6, date: '2026-11-21', meal: 'lunch' };
      const payload = {
        date: '2026-11-21',
        meal: 'lunch',
        startTime: '12:00',
        endTime: '14:00',
        copyTablesFromSlotId: 5
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockCreatedSlot
      }));

      const result = await createStaffSlot(payload);

      expect(result).toEqual(mockCreatedSlot);
      expect(fetch).toHaveBeenCalledWith(
        '/api/slots',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      );
    });
  });

});