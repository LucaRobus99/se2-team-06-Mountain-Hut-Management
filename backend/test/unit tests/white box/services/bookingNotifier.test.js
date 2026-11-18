import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBookingNotifier, bookingEmailFields } from '../../../../src/services/bookingNotifier.js';

describe('bookingNotifier - White-Box Tests', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    // Silenzia console.error nei test che simulano fallimenti intentionali
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Missing or invalid emailService handling', () => {
    it('should return status skipped if emailService itself is null, undefined, or missing sendBookingEmail method', async () => {
      const notifierWithoutService = createBookingNotifier(null);
      const notifierWithEmptyService = createBookingNotifier({});

      const res1 = await notifierWithoutService.notify('created', { slot: {} }, 'test@example.com');
      const res2 = await notifierWithEmptyService.notify('created', { slot: {} }, 'test@example.com');

      expect(res1).toEqual({ status: 'skipped' });
      expect(res2).toEqual({ status: 'skipped' });
    });
  });

  describe('Delivery response status branches', () => {
    it('should return status skipped if delivery result explicitly indicates skipped', async () => {
      const emailService = {
        sendBookingEmail: vi.fn().mockResolvedValue({ skipped: true }),
      };
      const notifier = createBookingNotifier(emailService);

      const result = await notifier.notify('updated', { slot: {} }, 'test@example.com');
      expect(result).toEqual({ status: 'skipped' });
    });

    it('should return status sent if delivery result does not explicitly indicate skipped', async () => {
      const emailService = {
        sendBookingEmail: vi.fn().mockResolvedValue({ messageId: '12345' }),
      };
      const notifier = createBookingNotifier(emailService);

      const result = await notifier.notify('cancelled', { slot: {} }, 'test@example.com');
      expect(result).toEqual({ status: 'sent' });
    });
  });

  describe('Error resilience and catch branch', () => {
    it('should catch email dispatch errors, log them, and return status failed without throwing', async () => {
      const emailService = {
        sendBookingEmail: vi.fn().mockRejectedValue(new Error('SMTP server timeout')),
      };
      const notifier = createBookingNotifier(emailService);

      const result = await notifier.notify('created', { slot: {} }, 'test@example.com');

      expect(result).toEqual({ status: 'failed' });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('bookingEmailFields fallback cascades', () => {
    it('should fallback to null if both contactName and fallbackName are absent', () => {
      const mockView = {
        contactName: null,
        slot: { date: '2026-08-14', startTime: '12:00' },
        partySize: 1,
        requirements: [],
      };

      const fields = bookingEmailFields(mockView, null);
      expect(fields.name).toBeNull();
    });
  });

});