// All times shown in the hut's local timezone, including to visitors abroad.
const HUT_TIMEZONE = 'Europe/Rome';

export function hutNowKey(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: HUT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function bookingStartKey(booking) {
  const slot = booking?.slot;
  return `${slot?.date || ''}T${String(slot?.startTime || '').slice(0,5)}`;
}

export function bookingCategory(booking, now = new Date()) {
  if (booking?.status === 'cancelled' || booking?.status === 'canceled') return 'cancelled';
  return bookingStartKey(booking) >= hutNowKey(now) ? 'upcoming' : 'past';
}

export function bookingSummary(bookings, now = new Date()) {
  const categories = { upcoming: [], past: [], cancelled: [] };
  for (const booking of bookings) {
    if (!booking || !booking.slot?.date || !booking.slot?.startTime) continue;
    categories[bookingCategory(booking, now)].push(booking);
  }
  categories.upcoming.sort((a, b) => bookingStartKey(a).localeCompare(bookingStartKey(b)));
  categories.past.sort((a, b) => bookingStartKey(b).localeCompare(bookingStartKey(a)));
  categories.cancelled.sort((a, b) => bookingStartKey(b).localeCompare(bookingStartKey(a)));
  return categories;
}

export function readableBookingDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return date || '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`));
}

export function readableMeal(meal) {
  return ({ breakfast: 'Breakfast', lunch: 'Lunch', aperitivo: 'Aperitivo', dinner: 'Dinner' })[meal] || '';
}
