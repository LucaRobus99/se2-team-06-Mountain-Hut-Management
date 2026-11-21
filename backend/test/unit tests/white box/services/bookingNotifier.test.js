import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createBookingNotifier,
  bookingEmailFields,
} from '../../../../src/services/bookingNotifier.js';

const baseBooking = {
  id: 42,
  contactName: 'Mario Rossi',
  partySize: 2,
  split: false,
  requirements: [{ description: 'Vegetarian', allergies: false }],
  slot: {
    date: '2027-06-15',
    startTime: '12:00',
    endTime: '13:00',
    meal: 'lunch',
  },
};

describe('bookingNotifier - White-Box Tests', () => {
  let consoleErrorSpy;
  let consoleInfoSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Missing or invalid emailService handling', () => {
    it('should return status skipped if emailService is null, undefined, or lacks sendBookingEmail', async () => {
      const notifierNull = createBookingNotifier(null);
      const notifierUndefined = createBookingNotifier(undefined);
      const notifierEmpty = createBookingNotifier({});

      await expect(
        notifierNull.notify('created', baseBooking, 'test@example.com')
      ).resolves.toEqual({ status: 'skipped' });
      await expect(
        notifierUndefined.notify('created', baseBooking, 'test@example.com')
      ).resolves.toEqual({ status: 'skipped' });
      await expect(
        notifierEmpty.notify('created', baseBooking, 'test@example.com')
      ).resolves.toEqual({ status: 'skipped' });
    });
  });

  describe('Delivery response status branches', () => {
    it('should return status skipped and log skipped when delivery indicates skipped', async () => {
      const emailService = {
        sendBookingEmail: vi.fn().mockResolvedValue({ skipped: true }),
      };
      const notifier = createBookingNotifier(emailService);

      const result = await notifier.notify('updated', baseBooking, 'test@example.com');

      expect(result).toEqual({ status: 'skipped' });
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[booking-email] kind=updated booking=42 skipped'
      );
    });

    it('should report provider acceptance and log messageId when delivery.id is non-empty', async () => {
      const emailService = {
        sendBookingEmail: vi.fn().mockResolvedValue({ id: '<message-42>' }),
      };
      const notifier = createBookingNotifier(emailService);

      const result = await notifier.notify('created', baseBooking, 'guest@example.test');

      expect(result).toEqual({ status: 'sent' });
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[booking-email] kind=created booking=42 accepted messageId=<message-42>'
      );
    });

    it('should return failed and warn when delivery lacks a non-empty message id', async () => {
      const emailService = {
        sendBookingEmail: vi
          .fn()
          .mockResolvedValueOnce({})
          .mockResolvedValueOnce({ id: '   ' }),
      };
      const notifier = createBookingNotifier(emailService);

      await expect(
        notifier.notify('updated', baseBooking, 'guest@example.test')
      ).resolves.toEqual({ status: 'failed' });
      await expect(
        notifier.notify('cancelled', baseBooking, 'guest@example.test')
      ).resolves.toEqual({ status: 'failed' });

      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[booking-email] kind=updated booking=42 no provider message ID'
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[booking-email] kind=cancelled booking=42 no provider message ID'
      );
    });
  });

  describe('Error resilience and catch branch', () => {
    it('should catch errors, log status/code metadata, and return failed without throwing', async () => {
      const emailService = {
        sendBookingEmail: vi
          .fn()
          .mockRejectedValueOnce(Object.assign(new Error('Rate limited'), { status: 429, code: 'RATE_LIMIT' }))
          .mockRejectedValueOnce(Object.assign(new Error('Gateway error'), { statusCode: 502 }))
          .mockRejectedValueOnce(new Error('Plain failure')),
      };
      const notifier = createBookingNotifier(emailService);

      await expect(notifier.notify('created', baseBooking, 'a@example.com')).resolves.toEqual({
        status: 'failed',
      });
      await expect(notifier.notify('updated', baseBooking, 'b@example.com')).resolves.toEqual({
        status: 'failed',
      });
      await expect(notifier.notify('cancelled', baseBooking, 'c@example.com')).resolves.toEqual({
        status: 'failed',
      });

      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        1,
        '[booking-email] kind=created booking=42 failed',
        { status: 429, code: 'RATE_LIMIT' }
      );
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        2,
        '[booking-email] kind=updated booking=42 failed',
        { status: 502, code: null }
      );
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        3,
        '[booking-email] kind=cancelled booking=42 failed',
        { status: null, code: null }
      );
    });
  });

  describe('bookingEmailFields mapping & fallback cascades', () => {
    it('should map all fields and fallback from contactName to fallbackName to null', () => {
      expect(bookingEmailFields(baseBooking, 'Fallback')).toEqual({
        name: 'Mario Rossi',
        date: '2027-06-15',
        start_time: '12:00',
        end_time: '13:00',
        meal: 'lunch',
        guests: 2,
        split: false,
        booking_id: 42,
        party_requirements: [{ description: 'Vegetarian', allergies: false }],
      });

      const withoutContact = {
        ...baseBooking,
        contactName: null,
        slot: { date: '2027-06-15', startTime: '12:00' },
      };

      expect(bookingEmailFields(withoutContact, 'Staff Fallback')).toMatchObject({
        name: 'Staff Fallback',
        end_time: undefined,
        meal: undefined,
      });
      expect(bookingEmailFields(withoutContact, null).name).toBeNull();
    });
  });
});