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
import { describe, expect, it, vi } from 'vitest';
import { createBookingNotifier } from '../../../../src/services/bookingNotifier.js';

const booking = {
  id: 42, partySize: 2, split: false, requirements: [],
  slot: { date: '2027-06-15', startTime: '12:00', endTime: '13:00', meal: 'lunch' },
};

describe('Booking email acknowledgement', () => {
  it('reports provider acceptance and logs its message ID without exposing the recipient', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const notifier = createBookingNotifier({ sendBookingEmail: vi.fn().mockResolvedValue({ id: '<message-42>' }) });
      expect(await notifier.notify('created', booking, 'guest@example.test')).toEqual({ status: 'sent' });
      expect(info).toHaveBeenCalledWith('[booking-email] kind=created booking=42 accepted messageId=<message-42>');
    } finally { info.mockRestore(); }
  });

  it('does not claim acceptance when the provider returns no message ID', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const notifier = createBookingNotifier({ sendBookingEmail: vi.fn().mockResolvedValue({}) });
      expect(await notifier.notify('updated', booking, 'guest@example.test')).toEqual({ status: 'failed' });
      expect(warn).toHaveBeenCalledWith('[booking-email] kind=updated booking=42 no provider message ID');
    } finally { warn.mockRestore(); }
  });
});
