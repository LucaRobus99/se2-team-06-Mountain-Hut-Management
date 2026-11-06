import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateSearch,
  getSlotSeating,
  getBooking,
  createBooking,
  bookingErrorMessage,
} from '../../../../src/api/booking.js';

describe('Booking API helpers - White-Box Unit Tests', () => {
  beforeEach(() => {
    // Mid-day in Rome, so "today" is the same date whatever the machine's time zone.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-14T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('validateSearch', () => {
    const valid = { date: '2026-08-14', meal: 'lunch', partySize: 2 };

    it('should accept today', () => {
      expect(validateSearch(valid)).toBe('');
    });

    it('should reject a date that is not in YYYY-MM-DD format', () => {
      expect(validateSearch({ ...valid, date: '14/08/2026' })).toBe('Please select a valid date.');
    });

    it('should reject a date that does not exist', () => {
      expect(validateSearch({ ...valid, date: '2026-02-31' })).toBe('Please select a valid date.');
    });

    it('should reject a past date', () => {
      expect(validateSearch({ ...valid, date: '2026-08-13' })).toBe('Please select today or a future date.');
    });

    it('should reject an unknown meal', () => {
      expect(validateSearch({ ...valid, meal: 'brunch' })).toBe('Please select a meal.');
    });

    it('should reject a party size sent as text', () => {
      expect(validateSearch({ ...valid, partySize: '2' })).toBe('Please enter a positive whole number of guests.');
    });
  });

  describe('request errors', () => {
    it('should raise a NETWORK_ERROR when the server cannot be reached', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

      await expect(getBooking(1)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    });

    it('should expose the status, code and details of an API error', async () => {
      const details = [{ field: 'slotId', message: 'bad' }];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: { code: 'INSUFFICIENT_CAPACITY', message: 'Full.', details } }),
      }));

      await expect(createBooking({ slotId: 1, partySize: 2 })).rejects.toMatchObject({
        message: 'Full.',
        status: 409,
        code: 'INSUFFICIENT_CAPACITY',
        details,
      });
    });

    it('should fall back to a generic error when the body is not JSON', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => { throw new Error('not json'); },
      }));

      await expect(getBooking(1)).rejects.toMatchObject({
        message: 'The request could not be completed.',
        status: 502,
        code: 'HTTP_ERROR',
        details: [],
      });
    });

    it('should return null for a 204 response without reading the body', async () => {
      const json = vi.fn();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204, json }));

      await expect(getBooking(1)).resolves.toBeNull();
      expect(json).not.toHaveBeenCalled();
    });
  });

  describe('getSlotSeating', () => {
    it('should reject an invalid slot or party before calling the API', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await expect(getSlotSeating({ slotId: 0, partySize: 2 }))
        .rejects.toThrow('Please select an available time and a valid number of guests.');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('getBooking', () => {
    it('should reject an invalid reference before calling the API', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await expect(getBooking('abc')).rejects.toThrow('Invalid booking reference.');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should request the booking by id', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 7 }) });
      vi.stubGlobal('fetch', fetchMock);

      await expect(getBooking(7)).resolves.toEqual({ id: 7 });
      expect(fetchMock).toHaveBeenCalledWith('/api/bookings/7', expect.objectContaining({ credentials: 'include' }));
    });
  });

  describe('bookingErrorMessage', () => {
    it.each([
      ['UNAUTHENTICATED', 'Your session has expired. Please log in to continue.'],
      ['FORBIDDEN', 'Only Hiker accounts can make online bookings.'],
      ['INVALID_CREDENTIALS', 'Incorrect email or password.'],
      ['BOOKING_ALREADY_EXISTS', 'You already have a booking for this time. You cannot book the same slot twice.'],
      ['INSUFFICIENT_CAPACITY', 'The remaining seats have just been booked. Please choose another available time.'],
      ['SLOT_NOT_AVAILABLE', 'This time is no longer open for booking. Please choose another.'],
      ['SLOT_TOO_LATE', 'Bookings close two hours before the selected time. Please choose another.'],
      ['SLOT_NOT_FOUND', 'This time is no longer available. Please search again.'],
      ['NETWORK_ERROR', 'We cannot reach the server. Check your connection and try again.'],
    ])('should map %s to its message', (code, message) => {
      expect(bookingErrorMessage({ code })).toBe(message);
    });

    it('should show the first validation detail when there is one', () => {
      const error = { code: 'VALIDATION_ERROR', details: [{ message: 'partySize is required.' }] };

      expect(bookingErrorMessage(error)).toBe('partySize is required.');
    });

    it('should fall back to a generic validation message', () => {
      expect(bookingErrorMessage({ code: 'VALIDATION_ERROR' })).toBe('Please check the information entered.');
    });

    it('should use the error message for unknown codes', () => {
      expect(bookingErrorMessage({ code: 'OTHER', message: 'Boom.' })).toBe('Boom.');
    });

    it('should have a default when there is no error at all', () => {
      expect(bookingErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
    });
  });
});
