import { describe, expect, it, vi } from 'vitest';
import { bookingEmailFields, createBookingNotifier } from '../../../../src/services/bookingNotifier.js';

const booking = {
  id: 42, partySize: 2, split: false, requirements: [],
  slot: { date: '2027-06-15', startTime: '12:00', endTime: '13:00', meal: 'lunch' },
};

describe('Booking email acknowledgement', () => {
  it('formats the reservation exactly as in the booking receipt, retaining raw values', () => {
    const fields = bookingEmailFields({ ...booking, partySize: 1, slot: { ...booking.slot, meal: 'aperitivo' } });
    expect(fields).toMatchObject({
      date: '2027-06-15', display_date: '15 June 2027',
      meal: 'aperitivo', display_meal: 'Aperitif',
      guests: 1, guest_label: '1 person',
    });
    expect(bookingEmailFields(booking).guest_label).toBe('2 people');
  });
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
