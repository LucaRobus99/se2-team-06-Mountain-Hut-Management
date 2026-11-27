import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  todayInHut,
  mealLabel,
  listStaffSlots,
  listSlotCatalog,
  createCatalogTable,
  deleteCatalogTable,
  createStaffSlot,
  previewWeeklyCopy,
  copyWeeklySchedule,
} from '../../../../src/api/slots.js';

describe('Slot API - White-Box Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('todayInHut', () => {
    it('should return a date string in YYYY-MM-DD format', () => {
      const dateStr = todayInHut();
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should accept an explicit timeZone parameter', () => {
      const dateStr = todayInHut('UTC');
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('mealLabel', () => {
    it('should return the correct capitalized label for known meals', () => {
      expect(mealLabel('breakfast')).toBe('Breakfast');
      expect(mealLabel('lunch')).toBe('Lunch');
      expect(mealLabel('aperitivo')).toBe('Aperitif');
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
        json: async () => mockSlots,
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

      await expect(listStaffSlots('2026-11-20')).rejects.toThrow(
        'Cannot connect to the hut server. Please try again.'
      );
    });

    it('should throw server error when response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { code: 'FORBIDDEN', message: 'Staff only' } }),
      }));

      await expect(listStaffSlots('2026-11-20')).rejects.toThrow('Staff only');
    });
  });

  describe('Catalog & tables helpers', () => {
    it('should fetch slot catalog via GET /api/slots/catalog', async () => {
      const catalog = { tables: [{ tableId: 1, tableIdentifier: 'T1', seats: 4 }], timePatterns: [] };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => catalog,
      }));

      const result = await listSlotCatalog();
      expect(result).toEqual(catalog);
      expect(fetch).toHaveBeenCalledWith(
        '/api/slots/catalog',
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('should create a catalog table via POST /api/slots/tables', async () => {
      const created = { tableId: 10, tableIdentifier: 'T10', seats: 6 };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => created,
      }));

      const result = await createCatalogTable('T10', 6);
      expect(result).toEqual(created);
      expect(fetch).toHaveBeenCalledWith(
        '/api/slots/tables',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableIdentifier: 'T10', seats: 6 }),
        })
      );
    });

    it('should delete a catalog table with encoded ID via DELETE /api/slots/tables/:tableId', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => null,
      }));

      await deleteCatalogTable('T 1/2');
      expect(fetch).toHaveBeenCalledWith(
        '/api/slots/tables/T%201%2F2',
        expect.objectContaining({
          method: 'DELETE',
          credentials: 'include',
        })
      );
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
        tables: [{ id: 1, capacity: 4 }],
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockCreatedSlot,
      }));

      const result = await createStaffSlot(payload);

      expect(result).toEqual(mockCreatedSlot);
      expect(fetch).toHaveBeenCalledWith(
        '/api/slots',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
        copyTablesFromSlotId: 5,
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockCreatedSlot,
      }));

      const result = await createStaffSlot(payload);

      expect(result).toEqual(mockCreatedSlot);
      expect(fetch).toHaveBeenCalledWith(
        '/api/slots',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      );
    });
  });

  describe('Weekly copy helpers', () => {
    it('should request weekly copy preview via POST /api/staff/slots/copy-week/preview', async () => {
      const input = { sourceWeekStart: '2026-11-16', targetWeekStart: '2026-11-23' };
      const preview = { sourceCount: 4, targetCount: 0, revision: 'rev-1' };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => preview,
      }));

      const result = await previewWeeklyCopy(input);
      expect(result).toEqual(preview);
      expect(fetch).toHaveBeenCalledWith(
        '/api/staff/slots/copy-week/preview',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
      );
    });

    it('should copy weekly schedule via POST /api/staff/slots/copy-week', async () => {
      const input = {
        sourceWeekStart: '2026-11-16',
        targetWeekStart: '2026-11-23',
        expectedRevision: 'rev-1',
      };
      const copied = { targetWeekStart: '2026-11-23', copiedCount: 4 };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => copied,
      }));

      const result = await copyWeeklySchedule(input);
      expect(result).toEqual(copied);
      expect(fetch).toHaveBeenCalledWith(
        '/api/staff/slots/copy-week',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
      );
    });
  });

  describe('request error handling fallbacks', () => {
    it('should use default error message if response error body lacks a message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: {} }),
      }));

      await expect(listStaffSlots('2026-11-20')).rejects.toThrow('Unable to complete the request.');
    });

    it('should attach status, code, and details to the thrown error object', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid slot data',
            details: ['Field date is required'],
          },
        }),
      }));

      try {
        await listStaffSlots('2026-11-20');
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).toBe('Invalid slot data');
        expect(err.status).toBe(422);
        expect(err.code).toBe('VALIDATION_ERROR');
        expect(err.details).toEqual(['Field date is required']);
      }
    });
  });
});

describe('request helper edge cases', () => {
  it('should handle non-JSON error responses gracefully without crashing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('Invalid JSON stream');
      },
    }));

    await expect(listStaffSlots('2026-11-20')).rejects.toThrow('Unable to complete the request.');
  });

  it('should default details to an empty array if error.details is not an array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 'BAD_REQUEST',
          message: 'Bad request format',
          details: 'not-an-array',
        },
      }),
    }));

    try {
      await listStaffSlots('2026-11-20');
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err.message).toBe('Bad request format');
      expect(err.status).toBe(400);
      expect(err.details).toEqual([]);
    }
  });
});