import { describe, it, expect, vi } from 'vitest';
import {
  createBookingNotifier,
  bookingEmailFields,
  BOOKING_EMAIL_KINDS,
} from '../../../../src/services/bookingNotifier.js';

describe('bookingNotifier - Black-Box Tests', () => {
  const baseView = {
    id: 42,
    contactName: 'Mario Rossi',
    slot: {
      date: '2026-08-14',
      startTime: '12:00',
      endTime: '14:00',
      meal: 'lunch',
    },
    partySize: 3,
    split: false,
    requirements: [{ description: 'Gluten-free', allergies: true }],
  };

  describe('BOOKING_EMAIL_KINDS constant', () => {
    it('should export the expected email kinds array', () => {
      expect(BOOKING_EMAIL_KINDS).toEqual(['created', 'updated', 'cancelled']);
    });
  });

  describe('bookingEmailFields mapping', () => {
    it('should correctly map booking view properties to template payload fields', () => {
      const fields = bookingEmailFields(baseView, 'Fallback Name');

      expect(fields).toEqual({
        name: 'Mario Rossi',
        date: '2026-08-14',
        start_time: '12:00',
        end_time: '14:00',
        meal: 'lunch',
        guests: 3,
        split: false,
        booking_id: 42,
        party_requirements: [{ description: 'Gluten-free', allergies: true }],
      });
    });

    it('should fallback to fallbackName if contactName is missing on view, or null if absent', () => {
      const viewWithoutContact = {
        ...baseView,
        contactName: null,
        slot: { date: '2026-08-14', startTime: '12:00', meal: 'dinner' },
        partySize: 2,
        split: true,
        requirements: [],
      };

      expect(bookingEmailFields(viewWithoutContact, 'Staff Fallback').name).toBe('Staff Fallback');
      expect(bookingEmailFields(viewWithoutContact).name).toBeNull();
    });
  });

  describe('notify orchestration flow', () => {
    it('should return skipped status when emailService is missing or has no sendBookingEmail method', async () => {
      const notifierWithoutService = createBookingNotifier(null);
      const notifierWithoutMethod = createBookingNotifier({});

      await expect(
        notifierWithoutService.notify('created', baseView, 'mario@example.com')
      ).resolves.toEqual({ status: 'skipped' });

      await expect(
        notifierWithoutMethod.notify('created', baseView, 'mario@example.com')
      ).resolves.toEqual({ status: 'skipped' });
    });

    it('should return skipped status if emailService marks the delivery as skipped', async () => {
      const emailService = {
        sendBookingEmail: vi.fn().mockResolvedValue({ skipped: true }),
      };
      const notifier = createBookingNotifier(emailService);

      const result = await notifier.notify('created', baseView, null);

      expect(result).toEqual({ status: 'skipped' });
      expect(emailService.sendBookingEmail).toHaveBeenCalledWith(
        'created',
        null,
        expect.objectContaining({ booking_id: 42 })
      );
    });

    it('should return sent status when provider returns a non-empty message id for each email kind', async () => {
      for (const kind of BOOKING_EMAIL_KINDS) {
        const sendBookingEmail = vi.fn().mockResolvedValue({ id: `msg-${kind}-1` });
        const notifier = createBookingNotifier({ sendBookingEmail });

        const result = await notifier.notify(kind, baseView, 'mario@example.com');

        expect(result).toEqual({ status: 'sent' });
        expect(sendBookingEmail).toHaveBeenCalledWith(
          kind,
          'mario@example.com',
          bookingEmailFields(baseView, null)
        );
      }
    });

    it('should return failed status when delivery lacks a valid message id', async () => {
      const sendBookingEmail = vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ id: '' })
        .mockResolvedValueOnce({ id: '   ' });
      const notifier = createBookingNotifier({ sendBookingEmail });

      await expect(notifier.notify('created', baseView, 'mario@example.com')).resolves.toEqual({
        status: 'failed',
      });
      await expect(notifier.notify('created', baseView, 'mario@example.com')).resolves.toEqual({
        status: 'failed',
      });
      await expect(notifier.notify('created', baseView, 'mario@example.com')).resolves.toEqual({
        status: 'failed',
      });
    });

    it('should return failed status without throwing if sendBookingEmail rejects', async () => {
      const sendBookingEmail = vi.fn().mockRejectedValue(new Error('SMTP timeout'));
      const notifier = createBookingNotifier({ sendBookingEmail });

      const result = await notifier.notify('updated', baseView, 'mario@example.com');

      expect(result).toEqual({ status: 'failed' });
    });
  });
});