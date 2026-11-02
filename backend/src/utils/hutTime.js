/**
 * Time helpers for the hut's local time zone.
 *
 * Slots store a wall-clock date (`YYYY-MM-DD`) and time (`HH:MM`). The server
 * may run in any time zone, so comparisons must be done in the hut's zone
 * (default Europe/Rome) and not with the machine's local time.
 */

export const BOOKING_LEAD_MS = 2 * 60 * 60 * 1000;

// Creating an Intl formatter is relatively expensive; reuse one per time zone.
const formatterCache = new Map();

function formatterFor(timeZone) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function partsInZone(date, timeZone) {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/**
 * Converts a wall-clock date/time in `timeZone` to a real `Date` (UTC instant).
 * Example: 2026-08-14 13:00 in Europe/Rome → 2026-08-14T11:00:00.000Z.
 */
export function zonedTimeToUtc(date, time, timeZone) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  let instant = wallClockUtc;
  // Two passes handle the offset change around DST boundaries.
  for (let i = 0; i < 2; i += 1) {
    const parts = partsInZone(new Date(instant), timeZone);
    const asIfUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const offset = asIfUtc - instant;
    instant = wallClockUtc - offset;
  }
  return new Date(instant);
}

/** Today's date (`YYYY-MM-DD`) in the hut's time zone. */
export function todayInZone(timeZone, now = new Date()) {
  const { year, month, day } = partsInZone(now, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Whether a wall-clock date/time in the hut's zone has already started. */
export function isInPast(date, time, { timeZone, now = new Date() }) {
  return zonedTimeToUtc(date, time, timeZone).getTime() <= now.getTime();
}

/**
 * A slot can be booked until exactly two hours before its start.
 * At 11:00 a 13:00 slot is allowed; at 11:01 it is too late.
 */
export function isSlotTooLate(slot, { timeZone, now = new Date(), leadMs = BOOKING_LEAD_MS }) {
  const start = zonedTimeToUtc(slot.date, slot.start_time, timeZone);
  return start.getTime() - now.getTime() < leadMs;
}
