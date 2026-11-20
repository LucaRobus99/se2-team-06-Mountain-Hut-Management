import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAvailableSlots, getSlotSeating, createBooking, getBooking, getMyBookings, bookingErrorMessage, checkSlotBooking } from '../../../../src/api/booking.js';

describe('Booking API - White-Box Unit Tests (Complete Coverage)', () => {

  beforeEach(() => {
    // Clear all mocks and stubs before each test
    vi.restoreAllMocks();
  });

  describe('getAvailableSlots', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });
    it('should throw a validation error if partySize is not a positive integer', async () => {
      await expect(getAvailableSlots({ date: '2026-11-15', meal: 'lunch', partySize: 0 }))
        .rejects.toThrow('Please enter a positive whole number of guests.');
    });

    it('should throw a validation error if date is missing or invalid', async () => {
      await expect(getAvailableSlots({ date: '', meal: 'lunch', partySize: 2 }))
        .rejects.toThrow('Please select a valid date.');
      
      await expect(getAvailableSlots({ date: 'invalid-date', meal: 'lunch', partySize: 2 }))
        .rejects.toThrow('Please select a valid date.');
    });

    it('should throw validation error for past date', async () => {
      await expect(getAvailableSlots({ date: '2020-01-01', meal: 'lunch', partySize: 2 }))
        .rejects.toThrow('Please select today or a future date.');
    });

    it('should throw validation error for an invalid meal', async () => {
      await expect(getAvailableSlots({ date: '2026-11-15', meal: 'brunch', partySize: 2 }))
        .rejects.toThrow('Please select a meal.');
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

    it('should throw an error if slotId or partySize is invalid in getSlotSeating', async () => {
      await expect(getSlotSeating({ slotId: 0, partySize: 2 })).rejects.toThrow('Please select an available time and a valid number of guests.');
      await expect(getSlotSeating({ slotId: 1, partySize: -1 })).rejects.toThrow('Please select an available time and a valid number of guests.');
      await expect(getSlotSeating({ slotId: 'abc', partySize: 2 })).rejects.toThrow('Please select an available time and a valid number of guests.');
    });
  });

  describe('checkSlotBooking', () => {
    it('uses the current authenticated session and reads the booking status', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true, status: 200, json: async () => ({ alreadyBooked: true }),
      }));
      await expect(checkSlotBooking(12)).resolves.toBe(true);
      expect(fetch).toHaveBeenCalledWith('/api/bookings/slot-status?slotId=12',
        expect.objectContaining({ credentials: 'include' }));
    });

    it('rejects invalid slot IDs before contacting the backend', async () => {
      await expect(checkSlotBooking(0)).rejects.toThrow('Invalid time slot.');
    });

    it('throws an error if alreadyBooked in slot-status response is not a boolean', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true, status: 200, json: async () => ({ alreadyBooked: 'yes' }),
      }));
      await expect(checkSlotBooking(12)).rejects.toThrow('Unable to check your existing reservation. Please try again.');
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

  describe('getBooking', () => {
    it('should throw an error if bookingId is invalid', async () => {
      await expect(getBooking(0)).rejects.toThrow('Invalid booking reference.');
      await expect(getBooking('abc')).rejects.toThrow('Invalid booking reference.');
    });

    it('should successfully fetch booking details for a valid bookingId', async () => {
      const mockBooking = { id: 10, status: 'confirmed', partySize: 2 };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockBooking
      }));

      const result = await getBooking(10);
      expect(result).toEqual(mockBooking);
      expect(fetch).toHaveBeenCalledWith(
        '/api/bookings/10',
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('should throw NETWORK_ERROR if fetch fails completely', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));

      await expect(getBooking(10)).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: 'Unable to reach the server. Please try again later.'
      });
    });
  });

  describe('getMyBookings', () => {
    it('should successfully return bookings array when server responds correctly', async () => {
      const mockResponse = { bookings: [{ id: 1, status: 'confirmed' }] };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      }));

      const result = await getMyBookings();
      expect(result).toEqual(mockResponse.bookings);
      expect(fetch).toHaveBeenCalledWith(
        '/api/bookings',
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('should throw an error if the server response structure is invalid or missing bookings array', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ invalidKey: 'not an array' })
      }));

      await expect(getMyBookings()).rejects.toThrow('Unexpected bookings response from the server.');
    });
  });

  describe('bookingErrorMessage', () => {
    it('should return correct messages for known error codes', () => {
      expect(bookingErrorMessage({ code: 'UNAUTHENTICATED' })).toContain('session has expired');
      expect(bookingErrorMessage({ code: 'FORBIDDEN' })).toContain('Only Hiker accounts');
      expect(bookingErrorMessage({ code: 'INVALID_CREDENTIALS' })).toContain('Incorrect email or password.');
      expect(bookingErrorMessage({ code: 'BOOKING_ALREADY_EXISTS' })).toContain('already have a booking');
      expect(bookingErrorMessage({ code: 'INSUFFICIENT_CAPACITY' })).toContain('remaining seats have just been booked');
      expect(bookingErrorMessage({ code: 'SLOT_NOT_AVAILABLE' })).toContain('no longer open for booking');
      expect(bookingErrorMessage({ code: 'SLOT_TOO_LATE' })).toContain('Bookings close two hours');
      expect(bookingErrorMessage({ code: 'SLOT_NOT_FOUND' })).toContain('no longer available');
      expect(bookingErrorMessage({ code: 'NETWORK_ERROR' })).toContain('cannot reach the server');
    });

    it('should handle requirement validation errors specifically', () => {
      const error = {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'requirements.0.description', message: 'Invalid' }]
      };
      expect(bookingErrorMessage(error)).toContain('dietary requirements');
    });

    it('should handle generic validation error details if present', () => {
      const error = {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'partySize', message: 'Party size is too large' }]
      };
      expect(bookingErrorMessage(error)).toBe('Party size is too large');
    });

    it('should fallback to default error message if code is unknown', () => {
      expect(bookingErrorMessage({ message: 'Custom server error' })).toBe('Custom server error');
    });
  });

});
