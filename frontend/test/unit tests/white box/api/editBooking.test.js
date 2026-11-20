import { describe, it, expect, vi, afterEach } from 'vitest';
import { updateBooking, getModificationSlots, bookingErrorMessage } from '../../../../src/api/booking.js';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('MH-06 PATCH booking API', () => {
  it('searches availability for the owned booking with its ID but no user ID', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));
    const result = { slots: [{ id: 3 }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => result }));
    await expect(getModificationSlots(17, { date: '2027-06-15', meal: 'lunch', partySize: 3 })).resolves.toEqual(result);
    expect(fetch).toHaveBeenCalledWith('/api/bookings/17/availability?date=2027-06-15&meal=lunch&partySize=3',
      expect.objectContaining({ credentials: 'include' }));
  });

  it('uses an editing-specific message for invalid dietary requirements', () => {
    const error = { code: 'VALIDATION_ERROR', details: [{ field: 'requirements[0].description', message: 'Enter a description.' }] };
    expect(bookingErrorMessage(error, { editing: true })).toBe('Enter a description.');
  });
  it('sends a partial update with credentials and no hiker ID', async () => {
    const updated = { id: 17, partySize: 3, confirmationEmail: { status: 'sent' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => updated }));
    await expect(updateBooking(17, { partySize: 3 })).resolves.toEqual(updated);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/api/bookings/17');
    expect(init).toMatchObject({ method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(init.body)).toEqual({ partySize: 3 });
  });
  it('preserves multiple dietary entries with allergy flags', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 17 }) }));
    await updateBooking(17, { requirements: [
      { id: 9, description: ' 2 vegetarians ', allergies: false },
      { id: 8, description: '1 peanut allergy', allergies: true },
    ] });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ requirements: [
      { description: '2 vegetarians', allergies: false },
      { description: '1 peanut allergy', allergies: true },
    ] });
  });
  it('allows clearing the stored dietary requirements explicitly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 17 }) }));
    await updateBooking(17, { requirements: [] });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ requirements: [] });
  });
  it('rejects empty/unknown updates without making a network call', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(updateBooking(17, {})).rejects.toThrow(/make a change/i);
    await expect(updateBooking(17, { hikerId: 8 })).rejects.toThrow(/make a change/i);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('propagates transactional capacity refusal without misreporting success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409,
      json: async () => ({ error: { code: 'INSUFFICIENT_CAPACITY', message: 'Not enough seats.' } }) }));
    await expect(updateBooking(17, { partySize: 6 })).rejects.toMatchObject({ code: 'INSUFFICIENT_CAPACITY', status: 409 });
  });
});
