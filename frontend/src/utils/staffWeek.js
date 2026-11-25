const rangeFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function addDays(iso, offset) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function mondayOf(iso) {
  if (!iso) return '';
  const date = new Date(`${iso}T12:00:00Z`);
  return addDays(iso, -((date.getUTCDay() + 6) % 7));
}

export function weekRange(iso) {
  return `${rangeFormat.format(new Date(`${iso}T12:00:00Z`))} – ${rangeFormat.format(new Date(`${addDays(iso, 6)}T12:00:00Z`))}`;
}
