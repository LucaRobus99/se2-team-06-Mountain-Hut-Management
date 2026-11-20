import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

// An injected clock keeps the 48-hour boundary independent of the date of the run.
const NOW = new Date('2027-06-12T10:00:00Z'); // 12:00 in Europe/Rome
const DATE = '2027-06-15';
const requirements = [{ description: 'One vegetarian guest', allergies: false }];
const sendBookingEmail = vi.fn();

describe('MH-06 — modification availability and transactional updates', () => {
  let db, app, owner, other, original, alternative, booking;

  async function slot(date, start, end, capacity, status = 'available') {
    const { rows } = await db.query(
      'INSERT INTO slots (meal_id, date, start_time, end_time, status) VALUES (2, $1, $2, $3, $4) RETURNING id',
      [date, start, end, status]
    );
    const id = rows[0].id;
    await db.query('INSERT INTO slot_tables (slot_id, table_id, seats) VALUES ($1, 1, $2)', [id, capacity]);
    return id;
  }
  async function create(agent, slotId, partySize, dietary = []) {
    const res = await agent.post('/api/bookings').send({ slotId, partySize, requirements: dietary });
    expect(res.status).toBe(201);
    return res.body;
  }
  function preview(agent, partySize, date = DATE, id = booking.id) {
    return agent.get(`/api/bookings/${id}/availability`).query({ date, meal: 'lunch', partySize });
  }
  function change(agent, body, id = booking.id) {
    return agent.patch(`/api/bookings/${id}`).send(body);
  }

  beforeEach(async () => {
    sendBookingEmail.mockReset().mockResolvedValue({ skipped: true });
    db = createTestDb();
    app = createApp({ db, timeZone: 'Europe/Rome', now: () => NOW, emailService: { sendBookingEmail } });
    owner = request.agent(app);
    other = request.agent(app);
    expect((await owner.post('/api/auth/login').send({ email: 'hiker@hut.test', password: 'password' })).status).toBe(200);
    expect((await other.post('/api/auth/register').send({
      name: 'Other Hiker', email: 'other@hut.test', phone: '+39012345678', password: 'password',
    })).status).toBe(201);
    original = await slot(DATE, '12:00', '13:00', 4);
    alternative = await slot(DATE, '13:00', '14:00', 6);
    booking = await create(owner, original, 2, requirements);
  });

  afterEach(async () => { await db.close(); });

  it('credits only the original booking seats, without changing public availability or the booking', async () => {
    await create(other, original, 2);
    const before = (await owner.get(`/api/bookings/${booking.id}`)).body;
    const publicSearch = await request(app).get('/api/availability').query({ date: DATE, meal: 'lunch', partySize: 2 });
    expect(publicSearch.body.slots.map(s => s.id)).not.toContain(original);
    const available = await preview(owner, 2);
    expect(available.status).toBe(200);
    expect(available.body.slots.map(s => s.id)).toEqual([original, alternative]);
    expect(available.body.slots[0].tables).toEqual([{ freeSeats: 2 }]);
    expect((await preview(owner, 3)).body.slots.map(s => s.id)).toEqual([alternative]);
    expect((await owner.get(`/api/bookings/${booking.id}`)).body).toEqual(before);
    expect((await request(app).get('/api/availability').query({ date: DATE, meal: 'lunch', partySize: 2 })).body).toEqual(publicSearch.body);
  });

  it('omits duplicate and closed slots, and prevents another hiker from previewing or changing the booking', async () => {
    await create(owner, alternative, 1);
    await slot(DATE, '14:00', '15:00', 4, 'off');
    expect((await preview(owner, 2)).body.slots.map(s => s.id)).toEqual([original]);
    expect((await change(owner, { slotId: alternative })).body.error.code).toBe('BOOKING_ALREADY_EXISTS');
    expect((await preview(other, 2)).status).toBe(404);
    expect((await change(other, { partySize: 1 })).status).toBe(404);
    expect((await preview(request(app), 2)).status).toBe(401);
    expect((await preview(owner, 0)).status).toBe(400);
  });

  it('uses the exact 48-hour boundary for both preview and update, including the original slot', async () => {
    const tooSoon = await slot('2027-06-14', '11:00', '12:00', 4);
    const boundary = await slot('2027-06-14', '12:00', '13:00', 4);
    expect((await preview(owner, 2, '2027-06-14')).body.slots.map(s => s.id)).toEqual([boundary]);
    expect((await change(owner, { slotId: tooSoon })).body.error.code).toBe('TOO_LATE_TO_MODIFY');
    expect((await change(owner, { slotId: boundary })).status).toBe(200);
    const lateBooking = await create(owner, tooSoon, 1);
    expect((await preview(owner, 1, DATE, lateBooking.id)).body.error.code).toBe('TOO_LATE_TO_MODIFY');
    expect((await change(owner, { slotId: original }, lateBooking.id)).body.error.code).toBe('TOO_LATE_TO_MODIFY');
  });

  it('reallocates even requirements-only changes, clearing requirements when requested', async () => {
    // The booking initially occupies two places at T1 (capacity four).
    expect(booking.seatAssignments[0].tableId).toBe(1);
    await db.query('INSERT INTO slot_tables (slot_id, table_id, seats) VALUES ($1, 2, 2)', [original]);
    const updated = await change(owner, { requirements: [] });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ id: booking.id, partySize: 2, requirements: [],
      seatAssignments: [{ tableId: 2, seats: 2 }],
    });
    expect(updated.body.confirmationEmail).toHaveProperty('status');
    expect(sendBookingEmail).toHaveBeenCalledWith('updated', booking.email,
      expect.objectContaining({ booking_id: booking.id, party_requirements: [] }));
  });

  it('rolls back seats, slot, party size and requirements when an update fails', async () => {
    await create(other, alternative, 5);
    const before = (await owner.get(`/api/bookings/${booking.id}`)).body;
    const rejected = await change(owner, { slotId: alternative, partySize: 2, requirements: [] });
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe('INSUFFICIENT_CAPACITY');
    expect((await owner.get(`/api/bookings/${booking.id}`)).body).toEqual(before);
    expect(sendBookingEmail.mock.calls.some(([kind]) => kind === 'updated')).toBe(false);
    const publicSearch = await request(app).get('/api/availability').query({ date: DATE, meal: 'lunch', partySize: 1 });
    expect(publicSearch.body.slots.find(s => s.id === original).availableSeats).toBe(2);
    expect(publicSearch.body.slots.find(s => s.id === alternative).availableSeats).toBe(1);
  });

  it('previews split seating without table identifiers and rejects an unacknowledged new split', async () => {
    const first = await preview(owner, 4);
    expect(first.body.slots.find(s => s.id === alternative)).toMatchObject({
      fit: 'single_table', seatAssignments: [{ seats: 4 }],
    });
    await create(other, alternative, 5);
    await db.query('INSERT INTO slot_tables (slot_id, table_id, seats) VALUES ($1, 2, 3)', [alternative]);
    const next = await preview(owner, 4);
    const split = next.body.slots.find(s => s.id === alternative);
    expect(split.fit).toBe('split');
    expect(split.tables).toHaveLength(2);
    expect(split.tables).toEqual(expect.arrayContaining([{ freeSeats: 1 }, { freeSeats: 3 }]));
    expect(split.seatAssignments).toHaveLength(2);
    expect(split.seatAssignments.reduce((sum, s) => sum + s.seats, 0)).toBe(4);
    expect(split.seatAssignments.every(s => Object.keys(s).length === 1)).toBe(true);
    const before = (await owner.get(`/api/bookings/${booking.id}`)).body;
    const rejected = await change(owner, { slotId: alternative, partySize: 4, expectedSeating: 'single_table' });
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe('SEATING_CHANGED');
    expect((await owner.get(`/api/bookings/${booking.id}`)).body).toEqual(before);
    const accepted = await change(owner, { slotId: alternative, partySize: 4, expectedSeating: 'split' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.split).toBe(true);
  });

  it('saves a valid move atomically and keeps past and cancelled bookings in the history', async () => {
    const pastSlot = await slot('2027-06-01', '12:00', '13:00', 4);
    const { rows } = await db.query(
      'INSERT INTO bookings (slot_id, hiker_id, party_size, status, contact_name) VALUES ($1, $2, 1, $3, $4) RETURNING id',
      [pastSlot, booking.hikerId, 'confirmed', 'Past guest']
    );
    await db.query('INSERT INTO booking_seats (booking_id, table_id, seats) VALUES ($1, 1, 1)', [rows[0].id]);
    const cancelledSlot = await slot('2027-06-16', '12:00', '13:00', 4);
    const cancelled = await create(owner, cancelledSlot, 1);
    await db.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [cancelled.id]);
    const moved = await change(owner, { slotId: alternative, partySize: 4, requirements: [] });
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ id: booking.id, slot: { id: alternative }, partySize: 4, requirements: [] });
    const history = await owner.get('/api/bookings');
    expect(history.body.bookings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: booking.id, partySize: 4, slot: expect.objectContaining({ id: alternative }) }),
      expect.objectContaining({ id: rows[0].id, slot: expect.objectContaining({ date: '2027-06-01' }) }),
      expect.objectContaining({ id: cancelled.id, status: 'cancelled' }),
    ]));
    expect((await preview(owner, 1, DATE, cancelled.id)).body.error.code).toBe('BOOKING_NOT_CONFIRMED');
    expect((await change(owner, { partySize: 1 }, cancelled.id)).body.error.code).toBe('BOOKING_NOT_CONFIRMED');
  });

  it('sends one modification email with the saved reservation details after a successful update', async () => {
    const newDate = '2027-06-17';
    const target = await slot(newDate, '13:00', '14:00', 6);
    const newRequirements = [
      { description: 'Two vegetarian guests', allergies: false },
      { description: 'One guest allergic to peanuts', allergies: true },
    ];
    sendBookingEmail.mockClear().mockResolvedValueOnce({ id: '<modification-message>' });

    const updated = await change(owner, { slotId: target, partySize: 4, requirements: newRequirements });
    expect(updated.status).toBe(200);
    expect(updated.body.confirmationEmail).toEqual({ status: 'sent' });
    expect(sendBookingEmail).toHaveBeenCalledTimes(1);
    expect(sendBookingEmail).toHaveBeenCalledWith('updated', 'hiker@hut.test', {
      name: updated.body.contactName,
      date: newDate,
      start_time: '13:00',
      end_time: '14:00',
      meal: 'lunch',
      guests: 4,
      split: false,
      booking_id: booking.id,
      party_requirements: newRequirements,
    });
    expect((await owner.get(`/api/bookings/${booking.id}`)).body).toMatchObject({
      id: booking.id, partySize: 4, slot: { id: target, date: newDate }, requirements: newRequirements,
    });
  });

  it('does not undo the committed modification if the update email fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    let savedAtNotification;
    try {
      sendBookingEmail.mockImplementationOnce(async (kind, _recipient, fields) => {
        const { rows } = await db.query('SELECT slot_id, party_size FROM bookings WHERE id = $1', [fields.booking_id]);
        savedAtNotification = rows[0];
        throw new Error('Simulated mail delivery failure');
      });
      const updated = await change(owner, { slotId: alternative, partySize: 3 });
      expect(updated.status).toBe(200);
      expect(updated.body.confirmationEmail).toEqual({ status: 'failed' });
      expect(savedAtNotification).toMatchObject({ slot_id: alternative, party_size: 3 });
      expect((await owner.get(`/api/bookings/${booking.id}`)).body).toMatchObject({
        partySize: 3, slot: { id: alternative },
      });
      expect(sendBookingEmail).toHaveBeenLastCalledWith('updated', booking.email,
        expect.objectContaining({ booking_id: booking.id, guests: 3 }));
    } finally {
      log.mockRestore();
    }
  });
});
