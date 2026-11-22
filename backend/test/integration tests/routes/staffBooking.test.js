import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

describe('MH-07 — staff reservations and credentials', () => {
  let db, app, staff, hiker, slotId, now;
  const date = '2027-06-15';
  const sendBookingEmail = vi.fn();
  const sendPasswordReset = vi.fn();
  const login = (agent, email, password = 'password') => agent.post('/api/auth/login').send({ email, password });
  const reserve = (body) => staff.post('/api/staff/bookings').send({ slotId, partySize: 2, ...body });
  beforeEach(async () => {
    now = new Date('2027-06-15T09:30:00Z'); // 11:30 local: less than two hours before lunch.
    db = createTestDb();
    sendBookingEmail.mockReset().mockResolvedValue({ id: 'mock-booking' });
    sendPasswordReset.mockReset().mockResolvedValue({ id: 'mock-reset' });
    app = createApp({ db, timeZone: 'Europe/Rome', now: () => now, emailService: { sendBookingEmail, sendPasswordReset } });
    staff = request.agent(app); hiker = request.agent(app);
    expect((await login(staff, 'employee@hut.test')).status).toBe(200);
    expect((await login(hiker, 'hiker@hut.test')).status).toBe(200);
    const { rows } = await db.query("INSERT INTO slots (meal_id,date,start_time,end_time,status) VALUES (2,$1,'12:00','13:00','available') RETURNING id", [date]);
    slotId = rows[0].id;
    const second = await db.query("INSERT INTO dining_tables (label,seats) VALUES ('Second two-seat table',2) RETURNING id");
    await db.query('INSERT INTO slot_tables (slot_id,table_id,seats) VALUES ($1,1,2),($1,$2,2)', [slotId, second.rows[0].id]);
  });
  afterEach(async () => { await db.close(); });

  it('allows staff within the two-hour window, searches and books for an existing hiker', async () => {
    expect((await request(app).get('/api/availability').query({ date, meal: 'lunch', partySize: 2 })).body.slots).toEqual([]);
    const available = await staff.get('/api/staff/availability').query({ date, meal: 'lunch', partySize: 2 });
    expect(available.body.slots.map(s => s.id)).toContain(slotId);
    expect((await hiker.get('/api/staff/hikers').query({ query: 'Hanna' })).status).toBe(403);
    const results = await staff.get('/api/staff/hikers').query({ query: 'hiker@hut.test' });
    expect(results.body.hikers).toEqual([expect.objectContaining({ id: 3, email: 'hiker@hut.test' })]);
    const created = await reserve({ mode: 'existingHiker', hikerId: 3, expectedSeating: 'single_table' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ hikerId: 3, createdBy: 2, confirmationEmail: { status: 'sent' } });
    expect((await hiker.get('/api/bookings')).body.bookings).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.body.id })]));
    expect((await reserve({ mode: 'existingHiker', hikerId: 3 })).status).toBe(409);
    expect(sendBookingEmail).toHaveBeenCalledWith('created', 'hiker@hut.test', expect.any(Object));
  });

  it('creates a temporary guest without an account and rejects a new booking after slot start', async () => {
    const created = await reserve({ mode: 'guest', contactName: 'Walk-in Guest' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ hikerId: null, contactName: 'Walk-in Guest', confirmationEmail: { status: 'skipped' } });
    expect((await db.query("SELECT id FROM users WHERE name='Walk-in Guest'")).rows).toEqual([]);
    now = new Date('2027-06-15T10:01:00Z');
    expect((await reserve({ mode: 'guest', contactName: 'Late guest' })).body.error.code).toBe('SLOT_ALREADY_STARTED');
  });

  it('rolls back new accounts on capacity failure and enforces first password change', async () => {
    const identity = { mode: 'newHiker', name: 'New Hiker', email: 'new-hiker@hut.test', phone: '+39012345678' };
    const failed = await reserve({ ...identity, partySize: 8 });
    expect(failed.status).toBe(409);
    expect((await db.query('SELECT id FROM users WHERE email=$1', [identity.email])).rows).toEqual([]);
    const created = await reserve(identity);
    expect(created.status).toBe(201);
    expect(created.headers['cache-control']).toBe('no-store');
    expect(created.body.initialPassword).toEqual(expect.any(String));
    const guest = request.agent(app);
    const authenticated = await login(guest, identity.email, created.body.initialPassword);
    expect(authenticated.body.user.passwordChangeRequired).toBe(true);
    expect((await guest.get('/api/bookings')).body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    expect((await guest.post('/api/auth/change-password').send({ currentPassword: created.body.initialPassword, newPassword: 'NewPassword-123' })).status).toBe(204);
    expect((await guest.get('/api/bookings')).body.bookings).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.body.id })]));
  });

  it('requires a new split acknowledgement when capacity changes after preview', async () => {
    // Use a fresh slot layout with two single seats.
    const { rows } = await db.query("INSERT INTO slots (meal_id,date,start_time,end_time,status) VALUES (2,$1,'13:00','14:00','available') RETURNING id", [date]);
    const splitId = rows[0].id;
    const singles = await db.query("INSERT INTO dining_tables (label,seats) VALUES ('Single A',1),('Single B',1) RETURNING id");
    await db.query('INSERT INTO slot_tables (slot_id,table_id,seats) VALUES ($1,$2,1),($1,$3,1)', [splitId, ...singles.rows.map(t => t.id)]);
    const rejected = await reserve({ mode: 'guest', slotId: splitId, contactName: 'Split guest', expectedSeating: 'single_table' });
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe('SEATING_CHANGED');
    const confirmed = await reserve({ mode: 'guest', slotId: splitId, contactName: 'Split guest', expectedSeating: 'split' });
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.split).toBe(true);
  });

  it('sends a single-use reset link and accepts the new password', async () => {
    const anonymous = request(app);
    expect((await anonymous.post('/api/auth/forgot-password').send({ email: 'unknown@hut.test' })).status).toBe(204);
    expect(sendPasswordReset).not.toHaveBeenCalled();
    expect((await anonymous.post('/api/auth/forgot-password').send({ email: 'hiker@hut.test' })).status).toBe(204);
    const token = new URL(sendPasswordReset.mock.calls[0][0].resetUrl).searchParams.get('token');
    expect(sendPasswordReset.mock.calls[0][0].expiresInHours).toBe(24);
    const payload = { token, newPassword: 'ResetPassword-123' };
    expect((await anonymous.post('/api/auth/reset-password').send(payload)).status).toBe(204);
    expect((await anonymous.post('/api/auth/reset-password').send(payload)).status).toBe(400);
    expect((await login(request(app), 'hiker@hut.test', payload.newPassword)).status).toBe(200);
  });
});
