import { describe, expect, it } from 'vitest';
import { bookingCategory, bookingSummary } from '../../../../src/utils/bookingList.js';

const booking = (id, date, startTime, status = 'confirmed') => ({ id, status, slot: { date, startTime } });
const now = new Date('2026-11-11T11:00:00Z'); // 12:00 in Rome

describe('My bookings filters', () => {
  it('classifies future, past and cancelled bookings using Rome time', () => {
    expect(bookingCategory(booking(1, '2026-11-11', '13:00'), now)).toBe('upcoming');
    expect(bookingCategory(booking(2, '2026-11-11', '11:00'), now)).toBe('past');
    expect(bookingCategory(booking(3, '2026-11-11', '15:00', 'cancelled'), now)).toBe('cancelled');
  });

  it('handles alternative spelling for cancelled status ("canceled")', () => {
    expect(bookingCategory(booking(5, '2026-11-12', '12:00', 'canceled'), now)).toBe('cancelled');
  });

  it('orders upcoming ascending and past/cancelled descending', () => {
    const groups = bookingSummary([
      booking(2, '2026-11-13', '12:00'), booking(1, '2026-11-12', '12:00'),
      booking(3, '2026-11-09', '12:00'), booking(4, '2026-11-10', '12:00'),
      booking(5, '2026-11-10', '12:00', 'cancelled'), booking(6, '2026-11-12', '12:00', 'cancelled'),
    ], now);
    expect(groups.upcoming.map(({ id }) => id)).toEqual([1, 2]);
    expect(groups.past.map(({ id }) => id)).toEqual([4, 3]);
    expect(groups.cancelled.map(({ id }) => id)).toEqual([6, 5]);
  });

  it('filters out malformed or incomplete bookings in summary', () => {
    const groups = bookingSummary([
      null,
      { id: 99, slot: { date: '2026-11-12' } }, // missing startTime
      booking(1, '2026-11-12', '12:00'),
    ], now);
    expect(groups.upcoming.map(({ id }) => id)).toEqual([1]);
  });
});
