import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAvailableSlots, getSlotSeating, createBooking } from '../../../../src/api/booking.js';

describe('Booking API - White-Box Unit Tests', () => {

  beforeEach(() => {
    // Clear all mocks and stubs before each test
    vi.restoreAllMocks();
  });

  describe('getAvailableSlots', () => {
    it('should throw a validation error if partySize is not a positive integer', async () => {
      await expect(getAvailableSlots({ date: '2026-11-15', meal: 'lunch', partySize: 0 }))
        .rejects.toThrow('Please enter a positive whole number of guests.');
    });

    it('should throw a validation error if date is missing or invalid', async () => {
      await expect(getAvailableSlots({ date: '', meal: 'lunch', partySize: 2 }))
        .rejects.toThrow('Please select a valid date.');
    });

    it('should return available slots for a valid query', async () => {
      const mockResponse = {
        hutId: 1,
        date: '2026-11-15',
        meal: 'lunch',
        slots: [{ id: 1, startTime: '12:00', endTime: '13:30', availableSeats: 10 }]
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      }));

      const result = await getAvailableSlots({ date: '2026-11-15', meal: 'lunch', partySize: 2 });
      
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/availability?'),
        expect.objectContaining({ credentials: 'include' })
      );
    });
  });

  describe('getSlotSeating', () => {
    it('should return seating details and fit type for a valid slot', async () => {
      const mockSeating = {
        slotId: 1,
        partySize: 2,
        fit: 'exact',
        seatAssignments: [{ tableId: 1, seats: 2 }]
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSeating
      }));

      const seating = await getSlotSeating({ slotId: 1, partySize: 2 });
      
      expect(seating).toEqual(mockSeating);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/availability/1/seating?'),
        expect.objectContaining({ credentials: 'include' })
      );
    });
  });

  describe('createBooking', () => {
    it('should throw validation error if slotId or partySize is invalid', async () => {
      await expect(createBooking({ slotId: 0, partySize: 2 }))
        .rejects.toThrow('Please select an available time and a valid number of guests.');
    });

    it('should successfully create a booking when valid parameters are provided', async () => {
      const mockBooking = {
        id: 10,
        status: 'confirmed',
        partySize: 2,
        hikerId: 1
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockBooking
      }));

      const booking = await createBooking({ slotId: 1, partySize: 2 });

      expect(booking).toEqual(mockBooking);
      expect(fetch).toHaveBeenCalledWith(
        '/api/bookings',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slotId: 1, partySize: 2 })
        })
      );
    });

    it('sends each dietary requirement independently when supplied', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: 12 }),
      }));
      await createBooking({ slotId: 3, partySize: 4, requirements: [
        { id: 4, description: ' 2 vegetarian guests ', allergies: false },
        { id: 5, description: '1 peanut allergy', allergies: true },
      ] });
      const request = JSON.parse(fetch.mock.calls[0][1].body);
      expect(request).toEqual({
        slotId: 3,
        partySize: 4,
        requirements: [
          { description: '2 vegetarian guests', allergies: false },
          { description: '1 peanut allergy', allergies: true },
        ],
      });
    });

    it('does not silently discard requirements rejected by the backend', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: {
          code: 'VALIDATION_ERROR',
          details: [{ field: 'requirements', rule: 'unknown' }],
        } }),
      }));
      await expect(createBooking({
        slotId: 3, partySize: 2,
        requirements: [{ description: 'Peanut allergy', allergies: true }],
      })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    });

  });

});