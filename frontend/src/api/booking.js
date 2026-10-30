// MOCK TEMPORANEI per MHM-35. Nessuna richiesta al backend e nessun database reale.
// Le funzioni esportate imitano i dati del contratto REST API Mountain Hut.
// I dati restano in memoria: ricaricando la pagina, le prenotazioni mock spariscono.

// Per i test, ogni data usa gli stessi esempi di orario, ma ha slot distinti.
const slotTemplates = {
  breakfast: [
    {
      startTime: '09:30',
      tables: [
        { tableId: 1, tableLabel: 'T1', seats: 4, freeSeats: 4 },
        { tableId: 2, tableLabel: 'T2', seats: 2, freeSeats: 2 }
      ]
    }
  ],
  lunch: [
    {
      startTime: '12:00',
      tables: [
        { tableId: 1, tableLabel: 'T1', seats: 4, freeSeats: 4 },
        { tableId: 2, tableLabel: 'T2', seats: 2, freeSeats: 2 }
      ]
    },
    {
      startTime: '13:15',
      tables: [
        { tableId: 3, tableLabel: 'T3', seats: 6, freeSeats: 6 }
      ]
    }
  ],
  aperitivo: [
    {
      startTime: '16:00',
      tables: [{ tableId: 1, tableLabel: 'T1', seats: 4, freeSeats: 4 }]
    }
  ],
  dinner: [
    {
      startTime: '19:00',
      tables: [
        { tableId: 1, tableLabel: 'T1', seats: 4, freeSeats: 4 },
        { tableId: 2, tableLabel: 'T2', seats: 4, freeSeats: 2 }
      ]
    }
  ]
};

const otherHiker = {
  id: -1,
  displayName: 'Another Hiker',
  email: 'other.hiker@example.com',
  phone: null
};

const slotsBySearch = new Map();
const slotsById = new Map();
const confirmedBookings = new Map();
let nextSlotId = 1;
let nextBookingId = 318;

function mockError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function validatePartySize(partySize) {
  if (!Number.isInteger(partySize) || partySize < 1) {
    throw mockError(400, 'VALIDATION_ERROR', 'Number of guests must be a positive integer.');
  }
}

function getOrCreateSlots(date, meal) {
  const key = `${date}|${meal}`;
  if (!slotsBySearch.has(key)) {
    const slots = (slotTemplates[meal] || []).map((template) => {
      const slot = {
        id: nextSlotId++,
        date,
        meal,
        startTime: template.startTime,
        status: 'available',
        tables: template.tables.map((table) => ({ ...table }))
      };
      slotsById.set(slot.id, slot);
      return slot;
    });
    slotsBySearch.set(key, slots);
  }
  return slotsBySearch.get(key);
}

function freeSeats(slot) {
  return slot.tables.reduce((sum,table) => sum + table.freeSeats, 0);
}

// Confronto in ora locale del rifugio (Europe/Rome), inclusi i secondi.
function isAtLeastTwoHoursAway(date, startTime) {
  const cutoff = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  });
  const fields = Object.fromEntries(
    formatter.formatToParts(cutoff).map(({ type, value }) => [type, value])
  );
  const earliest = `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}:${fields.second}`;
  return `${date}T${startTime}:00` >= earliest;
}

// Mock della regola del professore: un tavolo se possibile, altrimenti una
// divisione semplice tra il minor numero possibile di tavoli.
function calculateAssignments(slot, partySize) {
  const tables = slot.tables.filter((table) => table.freeSeats > 0);
  if (freeSeats(slot) < partySize) return null;

  const single = tables
    .filter((table) => table.freeSeats >= partySize)
    .sort((a, b) => a.freeSeats - b.freeSeats)[0];

  if (single) {
    return [{ tableId: single.tableId, tableLabel: single.tableLabel, seats: partySize }];
  }

  const sorted = [...tables].sort((a, b) => b.freeSeats - a.freeSeats);
  const assignments = [];
  let remaining = partySize;
  for (const table of sorted) {
    if (remaining === 0) break;
    const seats = Math.min(remaining, table.freeSeats);
    assignments.push({ tableId: table.tableId, tableLabel: table.tableLabel, seats });
    remaining -= seats;
  }
  return remaining === 0 ? assignments : null;
}

function getBookableSlot(slotId) {
  const slot = slotsById.get(slotId);
  if (!slot) throw mockError(404, 'SLOT_NOT_FOUND', 'The selected slot does not exist.');
  if (slot.status !== 'available') {
    throw mockError(409, 'SLOT_NOT_AVAILABLE', 'The selected slot is closed.');
  }
  if (!isAtLeastTwoHoursAway(slot.date, slot.startTime)) {
    throw mockError(422, 'SLOT_TOO_LATE', 'Bookings close two hours before the slot starts.');
  }
  return slot;
}

// Simula GET /api/huts/1/slots?date=...&meal=...&partySize=...
export async function getAvailableSlots({ date, meal, partySize }) {
  validatePartySize(partySize);
  if (!date || !slotTemplates[meal]) {
    throw mockError(400, 'VALIDATION_ERROR', 'Please select a date and a meal.');
  }
  const slots = getOrCreateSlots(date, meal)
    .filter((slot) =>
      slot.status === 'available' &&
      isAtLeastTwoHoursAway(slot.date, slot.startTime) &&
      calculateAssignments(slot, partySize) !== null
    )
    .map((slot) => ({
      id: slot.id,
      startTime: slot.startTime,
      availableSeats: freeSeats(slot),
      tables: slot.tables.map((table) => ({ ...table }))
    }));
  return { hutId: 1, date, meal, partySize, slots };
}

// Simula GET /api/huts/1/slots/{slotId}/seating?partySize=...
export async function getSlotSeating({ slotId, partySize }) {
  validatePartySize(partySize);
  const slot = getBookableSlot(slotId);
  const seatAssignments = calculateAssignments(slot, partySize);
  if (!seatAssignments) {
    throw mockError(409, 'INSUFFICIENT_CAPACITY', 'There are not enough seats available.');
  }
  const split = seatAssignments.length > 1;
  return {
    hutId: 1,
    slotId,
    partySize,
    fit: split ? 'split' : 'single_table',
    requiresConfirmation: split,
    ...(split && {
      confirmation: {
        code: 'GROUP_SPLIT',
        message: 'There is no single table for the whole group. The party will be split across tables.'
      }
    }),
    seatAssignments,
    availableSeats: freeSeats(slot),
    tables: slot.tables.map((table) => ({ ...table }))
  };
}

function saveMockBooking({ slotId, partySize, contactName, email, phone }, hiker) {
  validatePartySize(partySize);
  const slot = getBookableSlot(slotId);
  const key = `${hiker.id}|${slotId}`;
  if (confirmedBookings.has(key)) {
    throw mockError(409, 'BOOKING_ALREADY_EXISTS', 'You already have a booking for this time slot.');
  }
  const seatAssignments = calculateAssignments(slot, partySize);
  if (!seatAssignments) {
    throw mockError(409, 'INSUFFICIENT_CAPACITY', 'Not enough seats are available anymore.');
  }

  // Aggiorna i posti SOLO al momento della conferma, non alla selezione dello slot.
  for (const assignment of seatAssignments) {
    const table = slot.tables.find((item) => item.tableId === assignment.tableId);
    table.freeSeats -= assignment.seats;
  }
  const split = seatAssignments.length > 1;
  const booking = {
    id: nextBookingId++,
    status: 'confirmed',
    hikerId: hiker.id,
    slot: { id: slot.id, date: slot.date, startTime: slot.startTime, meal: slot.meal },
    partySize,
    contactName: contactName || hiker.displayName,
    email: email || hiker.email,
    phone: phone === undefined ? hiker.phone : phone,
    split,
    seatAssignments,
    ...(split && {
      notice: {
        code: 'GROUP_SPLIT',
        message: 'The group will be seated across multiple tables.'
      }
    }),
    createdAt: new Date().toISOString()
  };
  confirmedBookings.set(key, booking);
  return booking;
}

// Solo la prenotazione e' mock: riceviamo l'utente dalla sessione reale del frontend.
// Quando useremo la POST reale, NON invieremo hikerId nel body: lo ricava il backend dal cookie.
export async function createBooking({ slotId, partySize, contactName, email, phone }, currentUser) {
  if (!currentUser) throw mockError(401, 'UNAUTHENTICATED', 'Please log in to book.');
  if (currentUser.role !== 'hiker') {
    throw mockError(403, 'FORBIDDEN', 'Only Hikers can book online.');
  }
  return saveMockBooking({ slotId, partySize, contactName, email, phone }, currentUser);
}

// SOLO PER TEST: simula un'altra persona che prenota prima della conferma.
// Non fa parte delle vere API e non andra' usato nell'integrazione col backend.
export async function simulateOtherBooking({ slotId, partySize }) {
  return saveMockBooking({ slotId, partySize }, otherHiker);
}
