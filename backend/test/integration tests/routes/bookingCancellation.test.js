import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

const sendBookingEmail = vi.fn();

describe('MH-08 — cancellation', () => {
  let db, app, owner, other, staff, booking, slotId, now;
  const date = '2027-06-15';
  const requirements = [{ description: 'Peanut allergy', allergies: true }];
  const availability = () => request(app).get('/api/availability').query({ date, meal: 'lunch', partySize: 2 });
  const cancel = (agent, id = booking.id) => agent.delete(`/api/bookings/${id}`);

  beforeEach(async () => {
    now = new Date('2027-06-14T08:00:00Z');
    sendBookingEmail.mockReset().mockResolvedValue({ id: 'test-mail' });
    db = createTestDb();
    app = createApp({ db, timeZone: 'Europe/Rome', now: () => now, emailService: { sendBookingEmail } });
    owner = request.agent(app);
    other = request.agent(app);
    staff = request.agent(app);
    expect((await owner.post('/api/auth/login').send({ email: 'hiker@hut.test', password: 'password' })).status).toBe(200);
    expect((await staff.post('/api/auth/login').send({ email: 'warden@hut.test', password: 'password' })).status).toBe(200);
    expect((await other.post('/api/auth/register').send({
      name: 'Other Hiker', email: 'cancel-other@hut.test', phone: '+39012345678', password: 'password',
    })).status).toBe(201);
    const { rows } = await db.query(
      "INSERT INTO slots (meal_id, date, start_time, end_time, status) VALUES (2, $1, '12:00', '13:00', 'available') RETURNING id",
      [date]
    );
    slotId = rows[0].id;
    await db.query('INSERT INTO slot_tables (slot_id, table_id, seats) VALUES ($1, 1, 2)', [slotId]);
    const created = await owner.post('/api/bookings').send({ slotId, partySize: 2, requirements });
    expect(created.status).toBe(201);
    booking = created.body;
    sendBookingEmail.mockClear();
  });

  afterEach(async () => { await db.close(); });

  it('releases capacity once within 48 hours, retains history and sends exactly one cancellation email', async () => {
    expect((await availability()).body.slots.map(s => s.id)).not.toContain(slotId);
    const result = await cancel(owner);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ id: booking.id, status: 'cancelled', partySize: 2, requirements,
      alreadyCancelled: false, cancellationEmail: { status: 'sent' } });
    expect((await availability()).body.slots.find(s => s.id === slotId).availableSeats).toBe(2);
    expect((await owner.get('/api/bookings')).body.bookings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: booking.id, status: 'cancelled', requirements }),
    ]));
    expect((await cancel(owner)).body).toMatchObject({ alreadyCancelled: true, cancellationEmail: { status: 'skipped' } });
    expect((await availability()).body.slots.find(s => s.id === slotId).availableSeats).toBe(2);
    expect(sendBookingEmail).toHaveBeenCalledTimes(1);
    expect(sendBookingEmail).toHaveBeenCalledWith('cancelled', booking.email, expect.objectContaining({ booking_id: booking.id }));
    const replacement = await other.post('/api/bookings').send({ slotId, partySize: 2 });
    expect(replacement.status).toBe(201);
  });

  it('rejects anonymous, staff and non-owner requests without changing the booking', async () => {
    expect((await cancel(request(app))).status).toBe(401);
    expect((await cancel(staff)).status).toBe(403);
    expect((await cancel(other)).status).toBe(404);
    expect((await cancel(owner, 999999)).status).toBe(404);
    expect((await owner.get(`/api/bookings/${booking.id}`)).body.status).toBe('confirmed');
    expect(sendBookingEmail).not.toHaveBeenCalled();
  });

  it('permits cancelling a past booking', async () => {
    now = new Date('2027-06-16T10:00:00Z');
    // The injected clock also advances the authentication session expiry.
    owner = request.agent(app);
    expect((await owner.post('/api/auth/login').send({ email: 'hiker@hut.test', password: 'password' })).status).toBe(200);
    const result = await cancel(owner);
    expect(result.status).toBe(200);
    expect(result.body.status).toBe('cancelled');
  });

  it('keeps the cancellation committed if the email fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    sendBookingEmail.mockRejectedValueOnce(new Error('Mail unavailable'));
    try {
      const result = await cancel(owner);
      expect(result.status).toBe(200);
      expect(result.body.cancellationEmail).toEqual({ status: 'failed' });
      expect((await owner.get(`/api/bookings/${booking.id}`)).body.status).toBe('cancelled');
      expect((await availability()).body.slots.find(s => s.id === slotId).availableSeats).toBe(2);
    } finally { log.mockRestore(); }
  });
});
