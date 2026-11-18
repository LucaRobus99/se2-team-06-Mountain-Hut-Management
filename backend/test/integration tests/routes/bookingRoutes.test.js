import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

describe('BookingRoutes - Integration Tests', () => {
  let db;
  let app;
  let agent;
  let futureSlotId;
  let secondFutureSlotId;

  beforeEach(async () => {
    // Initialize a clean test database (PostgreSQL) with schema and seed data
    db = createTestDb();
    // Create the Express app injecting the test database
    app = createApp({ db });
    // Create a Supertest agent to maintain session cookies across requests
    agent = request.agent(app);

    // Creiamo dinamicamente uno slot nel futuro (es. 2027-06-15) per evitare qualsiasi blocco temporale (48h / slot passati)
    const slotRes = await db.query(
      `INSERT INTO slots (meal_id, date, start_time, end_time, status) 
       VALUES (2, '2027-06-15', '12:00', '13:00', 'available') RETURNING id`
    );
    futureSlotId = slotRes.rows[0].id;

    // Colleghiamo un tavolo con capienza sufficiente allo slot
    await db.query(
      `INSERT INTO slot_tables (slot_id, table_id, seats) VALUES ($1, 1, 6)`,
      [futureSlotId]
    );

    // Creiamo un secondo slot futuro per i test di aggiornamento (PATCH)
    const slotRes2 = await db.query(
      `INSERT INTO slots (meal_id, date, start_time, end_time, status) 
       VALUES (4, '2027-06-15', '19:00', '20:00', 'available') RETURNING id`
    );
    secondFutureSlotId = slotRes2.rows[0].id;

    await db.query(
      `INSERT INTO slot_tables (slot_id, table_id, seats) VALUES ($1, 2, 6)`,
      [secondFutureSlotId]
    );
  });

  afterEach(async () => {
    // Close the database connection after each test
    await db.close();
  });

  describe('GET /api/bookings – own booking history', () => {
    it('rejects unauthenticated requests', async () => {
      const response = await request(app).get('/api/bookings');
      expect(response.status).toBe(401);
    });

    it('returns only the hiker bookings, with saved dietary requirements', async () => {
      const loginRes = await agent.post('/api/auth/login').send({ email: 'hiker@hut.test', password: 'password' });
      expect(loginRes.status).toBe(200);

      const empty = await agent.get('/api/bookings');
      expect(empty.status).toBe(200);
      expect(empty.body).toEqual({ bookings: [] });

      const create = await agent.post('/api/bookings').send({
        slotId: futureSlotId,
        partySize: 2,
        requirements: [
          { description: '1 vegetarian guest', allergies: false },
          { description: '1 peanut allergy', allergies: true }
        ],
      });
      expect(create.status).toBe(201);

      // Another user's booking must never appear in this hiker's history.
      await db.query(
        `INSERT INTO bookings (slot_id, hiker_id, party_size, status, contact_name)
         VALUES ($1, $2, $3, 'confirmed', 'Another guest')`,
        [secondFutureSlotId, 1, 2],
      );

      const response = await agent.get('/api/bookings');
      expect(response.status).toBe(200);
      expect(response.body.bookings).toHaveLength(1);
      const booking = response.body.bookings[0];
      expect(booking.id).toBe(create.body.id);
      expect(booking.slot).toMatchObject({ id: futureSlotId });
      expect(booking.partySize).toBe(2);
      expect(booking.requirements).toEqual([
        { description: '1 vegetarian guest', allergies: false },
        { description: '1 peanut allergy', allergies: true },
      ]);
      expect(booking.seatAssignments.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/bookings/slot-status - preflight duplicate check', () => {
    it('requires a session and a valid slot ID', async () => {
      const anonymous = await request(app).get(`/api/bookings/slot-status?slotId=${futureSlotId}`);
      expect(anonymous.status).toBe(401);

      await agent.post('/api/auth/login').send({ email: 'hiker@hut.test', password: 'password' });

      const invalid = await agent.get('/api/bookings/slot-status?slotId=invalid');
      expect([400, 422]).toContain(invalid.status);
    });

    it('detects an existing booking before review, without changing seat allocation', async () => {
      await agent.post('/api/auth/login').send({ email: 'hiker@hut.test', password: 'password' });
      const before = await agent.get(`/api/bookings/slot-status?slotId=${futureSlotId}`);
      expect(before.status).toBe(200);
      expect(before.body).toEqual({ alreadyBooked: false });

      const created = await agent.post('/api/bookings').send({ slotId: futureSlotId, partySize: 2 });
      expect(created.status).toBe(201);

      const after = await agent.get(`/api/bookings/slot-status?slotId=${futureSlotId}`);
      expect(after.status).toBe(200);
      expect(after.body).toEqual({ alreadyBooked: true });

      // The POST still independently protects the booking from duplicate submissions.
      const duplicate = await agent.post('/api/bookings').send({ slotId: futureSlotId, partySize: 2 });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('BOOKING_ALREADY_EXISTS');
    });
  });

  describe('Authentication requirements', () => {
    
    it('should return 401 when trying to create a booking without being logged in', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({ slotId: futureSlotId, partySize: 2 });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should return 401 when trying to fetch a booking without being logged in', async () => {
      const response = await request(app).get('/api/bookings/1');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should return 401 when trying to update a booking without being logged in', async () => {
      const response = await request(app)
        .patch('/api/bookings/1')
        .send({ slotId: futureSlotId, partySize: 2 });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should return 401 when trying to cancel a booking without being logged in', async () => {
      const response = await request(app).delete('/api/bookings/1');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('POST /api/bookings & GET /api/bookings/:bookingId', () => {
    
    it('should allow an authenticated hiker to create a booking and then retrieve it', async () => {
      // Step 1: Login as a hiker from the seed data (e.g., Hanna Hiker)
      const loginResponse = await agent
        .post('/api/auth/login')
        .send({
          email: 'hiker@hut.test',
          password: 'password'
        });

      expect(loginResponse.status).toBe(200);

      // Step 2: Create a new booking using the authenticated agent
      // Slot ID 3 is available in the seed data for hut 1
      const createResponse = await agent
        .post('/api/bookings')
        .send({
          slotId: futureSlotId,
          partySize: 2
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.header).toHaveProperty('location');
      expect(createResponse.body).toHaveProperty('id');
      
      const createdBookingId = createResponse.body.id;

      // Step 3: Retrieve the newly created booking using the same agent
      const getResponse = await agent
        .get(`/api/bookings/${createdBookingId}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toHaveProperty('id', createdBookingId);
      expect(getResponse.body).toHaveProperty('partySize', 2);
    });
  });

  describe('PATCH /api/bookings/:bookingId - Update booking', () => {
    it('should allow an authenticated hiker to update their booking details', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'hiker@hut.test', password: 'password' });

      const createResponse = await agent
        .post('/api/bookings')
        .send({
          slotId: futureSlotId,
          partySize: 2
        });

      expect(createResponse.status).toBe(201);
      const bookingId = createResponse.body.id;

      const updateResponse = await agent
        .patch(`/api/bookings/${bookingId}`)
        .send({ slotId: secondFutureSlotId, partySize: 2 });

      expect([200, 201]).toContain(updateResponse.status);
    });

    it('should return error status when updating a non-existent booking', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'hiker@hut.test', password: 'password' });

      const response = await agent
        .patch('/api/bookings/999999')
        .send({ slotId: secondFutureSlotId, partySize: 2 });

      expect([400, 404, 422]).toContain(response.status);
    });
  });

  describe('DELETE /api/bookings/:bookingId - Cancel booking', () => {
    it('should allow an authenticated hiker to cancel their booking successfully', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'hiker@hut.test', password: 'password' });

      const createResponse = await agent
        .post('/api/bookings')
        .send({
          slotId: futureSlotId,
          partySize: 2
        });

      expect(createResponse.status).toBe(201);
      const bookingId = createResponse.body.id;

      const deleteResponse = await agent.delete(`/api/bookings/${bookingId}`);
      expect(deleteResponse.status).toBe(200);
    });
  });

  describe('Edge cases and error handling', () => {

    it('should return 400 or error status when trying to create a booking with invalid payload/slot', async () => {
      // Login first as a hiker
      await agent
        .post('/api/auth/login')
        .send({ email: 'hiker@hut.test', password: 'password' });

      // Send invalid booking payload (e.g. non-existent slot or missing partySize)
      const response = await agent
        .post('/api/bookings')
        .send({ slotId: 9999, partySize: -5 });

      // Expecting a client error status (400, 404, or 422 depending on business validation)
      expect([400, 404, 422, 409]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 when fetching a non-existent booking ID', async () => {
      // Login first
      await agent
        .post('/api/auth/login')
        .send({ email: 'hiker@hut.test', password: 'password' });

      const response = await agent
        .get('/api/bookings/999999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

  });

});