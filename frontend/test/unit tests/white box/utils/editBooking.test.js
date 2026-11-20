import { describe, expect, it } from 'vitest';
import { slotInstant, canModifyBooking, isValidModificationSlot, originalSlotOption, buildBookingChanges } from '../../../../src/utils/editBooking.js';

const booking = { id: 9, status: 'confirmed', partySize: 2,
  slot: { id: 3, date: '2026-11-20', meal: 'lunch', startTime: '12:00', endTime: '13:00' },
  requirements: [{ description: '1 vegetarian guest', allergies: false }],
};

describe('MH-06 edit-booking rules', () => {
  it('respects Rome local time in winter and summer', () => {
    expect(new Date(slotInstant('2026-11-20', '12:00')).toISOString()).toBe('2026-11-20T11:00:00.000Z');
    expect(new Date(slotInstant('2027-07-20', '12:00')).toISOString()).toBe('2027-07-20T10:00:00.000Z');
  });
  it('allows editing exactly 48 hours before the original slot, not a second later', () => {
    expect(canModifyBooking(booking, new Date('2026-11-18T11:00:00Z'))).toBe(true);
    expect(canModifyBooking(booking, new Date('2026-11-18T11:00:01Z'))).toBe(false);
  });
  it('does not allow editing past or cancelled bookings', () => {
    expect(canModifyBooking({ ...booking, status: 'cancelled' }, new Date('2026-11-10T10:00:00Z'))).toBe(false);
    expect(isValidModificationSlot('2026-11-20', '12:00', new Date('2026-11-18T11:00:01Z'))).toBe(false);
  });
  it('keeps original slot selectable for the original date and meal', () => {
    expect(originalSlotOption(booking, { date: '2026-11-20', meal: 'lunch' })).toMatchObject({ id: 3, original: true });
    expect(originalSlotOption(booking, { date: '2026-11-21', meal: 'lunch' })).toBeNull();
    expect(originalSlotOption(booking, { date: '2026-11-20', meal: 'dinner' })).toBeNull();
  });
  it('sends only changed fields and preserves allergies', () => {
    expect(buildBookingChanges(booking, { slotId: 3, partySize: 2, requirements: booking.requirements })).toEqual({});
    expect(buildBookingChanges(booking, { slotId: 4, partySize: 3, requirements: [
      { id: 44, description: ' Peanut allergy ', allergies: true },
    ] })).toEqual({ slotId: 4, partySize: 3, requirements: [{ description: 'Peanut allergy', allergies: true }] });
  });
  it('sends empty requirements list when clearing previous dietary needs', () => {
    expect(buildBookingChanges(booking, { slotId: 3, partySize: 2, requirements: [] })).toEqual({ requirements: [] });
  });
});
