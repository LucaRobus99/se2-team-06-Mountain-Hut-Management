import { describe, it, expect, vi } from 'vitest';
import { createBookingNotifier, bookingEmailFields, BOOKING_EMAIL_KINDS } from '../../../../src/services/bookingNotifier.js';

describe('bookingNotifier - Black-Box Tests', () => {

  describe('BOOKING_EMAIL_KINDS constant', () => {
    it('should export the expected email kinds array', () => {
      expect(BOOKING_EMAIL_KINDS).toEqual(['created', 'updated', 'cancelled']);
    });
  });

  describe('bookingEmailFields mapping', () => {
    it('should correctly map booking view properties to template payload fields', () => {
      const mockView = {
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

      const fields = bookingEmailFields(mockView, 'Fallback Name');

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

    it('should fallback to fallbackName if contactName is missing on view', () => {
      const mockView = {
        id: 42,
        contactName: null,
        slot: { date: '2026-08-14', startTime: '12:00', meal: 'dinner' },
        partySize: 2,
        split: true,
        requirements: [],
      };

      const fields = bookingEmailFields(mockView, 'Staff Fallback');
      expect(fields.name).toBe('Staff Fallback');
    });
  });

  describe('notify orchestration flow', () => {
    it('should return skipped status if emailService marks the delivery as skipped', async () => {
      const emailService = { 
        sendBookingEmail: vi.fn().mockResolvedValue({ skipped: true }) 
      };
      const notifier = createBookingNotifier(emailService);

      const mockView = { id: 1, slot: { date: '2026-08-14', startTime: '12:00' }, partySize: 2, requirements: [] };
      const result = await notifier.notify('created', mockView, null);

      expect(result).toEqual({ status: 'skipped' });
      expect(emailService.sendBookingEmail).toHaveBeenCalledWith('created', null, expect.any(Object));
    });

    it('should successfully send email and return status sent', async () => {
      const emailService = { sendBookingEmail: vi.fn().mockResolvedValue({ success: true }) };
      const notifier = createBookingNotifier(emailService);

      const mockView = { id: 1, slot: { date: '2026-08-14', startTime: '12:00' }, partySize: 2, requirements: [] };
      const result = await notifier.notify('created', mockView, 'mario@example.com');

      expect(result).toEqual({ status: 'sent' });
      expect(emailService.sendBookingEmail).toHaveBeenCalledTimes(1);
    });
  });

});