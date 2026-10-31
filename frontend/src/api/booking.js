// MH-01 / public MH-04: real REST calls. No client-side seat reservations.
// Vite proxies /api to Express on localhost:8080 in development.
const HUT_ID = 1;
const VALID_MEALS = new Set(['breakfast', 'lunch', 'aperitivo', 'dinner']);

function positiveInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function validateSearch({ date, meal, partySize }) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(new Date(`${date}T00:00:00Z`).getTime()) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    return 'Please select a valid date.';
  }
  if (date < new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())) {
    return 'Please select today or a future date.';
  }
  if (!VALID_MEALS.has(meal)) return 'Please select a meal.';
  if (!positiveInteger(partySize)) return 'Please enter a positive whole number of guests.';
  return '';
}

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(path, { credentials: 'include', ...options });
  } catch {
    const error = new Error('Unable to reach the server. Please try again later.');
    error.code = 'NETWORK_ERROR';
    throw error;
  }
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'The request could not be completed.');
    error.status = response.status;
    error.code = body?.error?.code || 'HTTP_ERROR';
    error.details = body?.error?.details || [];
    throw error;
  }
  return body;
}

export async function getAvailableSlots({ date, meal, partySize }) {
  const validationError = validateSearch({ date, meal, partySize });
  if (validationError) throw new Error(validationError);
  const params = new URLSearchParams({ date, meal, partySize: String(partySize) });
  return apiRequest(`/api/huts/${HUT_ID}/slots?${params}`);
}

export async function getSlotSeating({ slotId, partySize }) {
  if (!positiveInteger(slotId) || !positiveInteger(partySize)) {
    throw new Error('Please select an available time and a valid number of guests.');
  }
  return apiRequest(`/api/huts/${HUT_ID}/slots/${slotId}/seating?${new URLSearchParams({ partySize: String(partySize) })}`);
}

export async function createBooking({ slotId, partySize }) {
  if (!positiveInteger(slotId) || !positiveInteger(partySize)) {
    throw new Error('Please select an available time and a valid number of guests.');
  }
  // The server derives hikerId from the session cookie, and recomputes seats
  // transactionally. Do not send acceptSplit, table IDs, or client auth state.
  return apiRequest('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slotId, partySize }),
  });
}

export async function getBooking(bookingId) {
  if (!positiveInteger(bookingId)) throw new Error('Invalid booking reference.');
  return apiRequest(`/api/bookings/${bookingId}`);
}

export function bookingErrorMessage(error) {
  switch (error?.code) {
    case 'UNAUTHENTICATED': return 'Your session has expired. Please log in to continue.';
    case 'FORBIDDEN': return 'Only Hiker accounts can make online bookings.';
    case 'INVALID_CREDENTIALS': return 'Incorrect email or password.';
    case 'BOOKING_ALREADY_EXISTS': return 'You already have a booking for this time. You cannot book the same slot twice.';
    case 'INSUFFICIENT_CAPACITY': return 'The remaining seats have just been booked. Please choose another available time.';
    case 'SLOT_NOT_AVAILABLE': return 'This time is no longer open for booking. Please choose another.';
    case 'SLOT_TOO_LATE': return 'Bookings close two hours before the selected time. Please choose another.';
    case 'SLOT_NOT_FOUND': return 'This time is no longer available. Please search again.';
    case 'VALIDATION_ERROR': return error?.details?.[0]?.message || 'Please check the information entered.';
    case 'NETWORK_ERROR': return 'We cannot reach the server. Check your connection and try again.';
    default: return error?.message || 'Something went wrong. Please try again.';
  }
}
