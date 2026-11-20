import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelBooking } from '../../../../src/api/booking.js';

afterEach(() => vi.unstubAllGlobals());

describe('MH-08 cancellation API', () => {
  it('sends only the reservation reference and session credentials', async () => {
    const result = { id: 17, status: 'cancelled', cancellationEmail: { status: 'sent' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => result }));
    await expect(cancelBooking(17)).resolves.toEqual(result);
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/bookings/17', { method: 'DELETE', credentials: 'include' });
  });

  it('rejects invalid references without sending a request', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(cancelBooking(0)).rejects.toThrow('Invalid booking reference.');
    await expect(cancelBooking('17')).rejects.toThrow('Invalid booking reference.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('propagates server rejection without reporting a cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404,
      json: async () => ({ error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } }) }));
    await expect(cancelBooking(17)).rejects.toMatchObject({ code: 'BOOKING_NOT_FOUND', status: 404 });
  });
});
