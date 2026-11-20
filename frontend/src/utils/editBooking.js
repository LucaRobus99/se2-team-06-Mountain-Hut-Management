// MH-06: 48-hour cutoff in the hut's time zone, including daylight-saving changes.
// This is a UI guard; PATCH /api/bookings/:id remains authoritative.
export const HUT_ZONE = 'Europe/Rome';
const CUTOFF_MS = 48 * 60 * 60 * 1000;

export function slotInstant(date, time, zone = HUT_ZONE) {
  const [year, month, day] = String(date).split('-').map(Number);
  const [hour, minute] = String(time).slice(0, 5).split(':').map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return NaN;
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  for (let i = 0; i < 2; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second));
    instant = target - (wall - instant);
  }
  return instant;
}

export function canModifyBooking(booking, now = new Date()) {
  return booking?.status === 'confirmed' &&
    slotInstant(booking?.slot?.date, booking?.slot?.startTime) - now.getTime() >= CUTOFF_MS;
}

export function isValidModificationSlot(date, startTime, now = new Date()) {
  return slotInstant(date, startTime) - now.getTime() >= CUTOFF_MS;
}

export function originalSlotOption(booking, { date, meal }) {
  if (booking.slot.date !== date || booking.slot.meal !== meal) return null;
  return { id: booking.slot.id, startTime: booking.slot.startTime,
    endTime: booking.slot.endTime, meal, original: true };
}

export function buildBookingChanges(booking, { slotId, partySize, requirements }) {
  const updates = {};
  if (slotId !== booking.slot.id) updates.slotId = slotId;
  if (partySize !== booking.partySize) updates.partySize = partySize;
  const normalize = list => list.map(({ description, allergies }) => ({
    description: description.trim(), allergies: Boolean(allergies),
  }));
  const previous = normalize(booking.requirements || []);
  const next = normalize(requirements);
  if (JSON.stringify(previous) !== JSON.stringify(next)) updates.requirements = next;
  return updates;
}
