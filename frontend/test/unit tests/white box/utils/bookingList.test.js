import { describe, expect, it } from 'vitest';
import {
  bookingCategory,
  bookingSummary,
  hutNowKey,
  bookingStartKey,
  readableBookingDate,
  readableMeal,
} from '../../../../src/utils/bookingList.js';

const booking = (id, date, startTime, status = 'confirmed') => ({
  id,
  status,
  slot: { date, startTime },
});
const now = new Date('2026-11-11T11:00:00Z'); // 12:00 in Rome

describe('My bookings filters', () => {
  it('classifies future, past and cancelled bookings using Rome time', () => {
    expect(bookingCategory(booking(1, '2026-11-11', '13:00'), now)).toBe('upcoming');
    expect(bookingCategory(booking(2, '2026-11-11', '11:00'), now)).toBe('past');
    expect(bookingCategory(booking(3, '2026-11-11', '15:00', 'cancelled'), now)).toBe('cancelled');
  });

  it('orders upcoming ascending and past descending', () => {
    const groups = bookingSummary(
      [
        booking(2, '2026-11-13', '12:00'),
        booking(1, '2026-11-12', '12:00'),
        booking(3, '2026-11-09', '12:00'),
        booking(4, '2026-11-10', '12:00'),
      ],
      now
    );
    expect(groups.upcoming.map(({ id }) => id)).toEqual([1, 2]);
    expect(groups.past.map(({ id }) => id)).toEqual([4, 3]);
  });
});

describe('bookingList white-box edge cases', () => {
  it('formats Rome time key, booking start key, and fallbacks for missing fields', () => {
    expect(hutNowKey(new Date('2026-11-11T23:30:00Z'))).toBe('2026-11-12T00:30');
    expect(bookingStartKey({ slot: { date: '2026-11-11', startTime: '12:30:00' } })).toBe('2026-11-11T12:30');
    expect(bookingStartKey(null)).toBe('T');
    expect(bookingStartKey({})).toBe('T');
  });

  it('handles canceled spelling, exact timestamp equality, invalid summary items, and cancelled sorting', () => {
    expect(bookingCategory(booking(1, '2026-11-11', '15:00', 'canceled'), now)).toBe('cancelled');
    expect(bookingCategory(booking(2, '2026-11-11', '12:00', 'confirmed'), now)).toBe('upcoming');

    const groups = bookingSummary(
      [
        null,
        { id: 99, slot: { date: '2026-11-11' } },
        { id: 100, slot: { startTime: '12:00' } },
        booking(10, '2026-11-08', '12:00', 'cancelled'),
        booking(11, '2026-11-10', '12:00', 'cancelled'),
      ],
      now
    );

    expect(groups.upcoming).toHaveLength(0);
    expect(groups.past).toHaveLength(0);
    expect(groups.cancelled.map(({ id }) => id)).toEqual([11, 10]);
  });

  it('formats readable dates and meals including invalid/fallback inputs', () => {
    expect(readableBookingDate('2026-11-11')).toBe('11 November 2026');
    expect(readableBookingDate('not-a-date')).toBe('not-a-date');
    expect(readableBookingDate('')).toBe('—');
    expect(readableBookingDate(null)).toBe('—');

    expect(readableMeal('breakfast')).toBe('Breakfast');
    expect(readableMeal('lunch')).toBe('Lunch');
    expect(readableMeal('aperitivo')).toBe('Aperitif');
    expect(readableMeal('dinner')).toBe('Dinner');
    expect(readableMeal('brunch')).toBe('');
    expect(readableMeal(undefined)).toBe('');
  });
});