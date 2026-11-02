/** Staff-only slot operations. API still authorizes Employee/Warden on the server. */
async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, { credentials: 'include', ...options });
  } catch {
    throw new Error('Cannot connect to the hut server. Please try again.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'Unable to complete the request.');
    error.status = response.status;
    error.code = body?.error?.code;
    error.details = Array.isArray(body?.error?.details) ? body.error.details : [];
    throw error;
  }
  return body;
}

export function todayInHut(timeZone = 'Europe/Rome') {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function mealLabel(meal) {
  return ({ breakfast: 'Breakfast', lunch: 'Lunch', aperitivo: 'Aperitivo', dinner: 'Dinner' })[meal] || meal;
}

export async function listStaffSlots(date) {
  return request(`/api/slots?${new URLSearchParams({ date })}`);
}

export async function createStaffSlot({ date, meal, startTime, endTime, tables, copyTablesFromSlotId }) {
  return request('/api/slots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(copyTablesFromSlotId
      ? { date, meal, startTime, endTime, copyTablesFromSlotId }
      : { date, meal, startTime, endTime, tables }),
  });
}
