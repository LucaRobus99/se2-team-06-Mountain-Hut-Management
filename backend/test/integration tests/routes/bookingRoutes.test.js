import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

describe('BookingRoutes - Integration Tests', () => {
  let db;
  let app;
  let agent;

  beforeEach(() => {
    // Initialize a clean in-memory SQLite database with schema and seed data
    db = createTestDb();
    // Create the Express app injecting the test database
    app = createApp({ db });
    // Create a Supertest agent to maintain session cookies across requests
    agent = request.agent(app);
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
      await agent.post('/api/auth/login').send({ email: 'hiker@hut.test', password: 'password' });
      const empty = await agent.get('/api/bookings');
      expect(empty.status).toBe(200);
      expect(empty.body).toEqual({ bookings: [] });

      const create = await agent.post('/api/bookings').send({
        slotId: 3,
        partySize: 2,
        requirements: [{ description: '1 vegetarian guest', allergies: false },
          { description: '1 peanut allergy', allergies: true }],
      });
      expect(create.status).toBe(201);

      // Another user's booking must never appear in this hiker's history.
      await db.query(
        `INSERT INTO bookings (slot_id, hiker_id, party_size, status, contact_name)
         VALUES ($1, $2, $3, 'confirmed', 'Another guest')`,
        [4, 1, 2],
      );

      const response = await agent.get('/api/bookings');
      expect(response.status).toBe(200);
      expect(response.body.bookings).toHaveLength(1);
      const booking = response.body.bookings[0];
      expect(booking.id).toBe(create.body.id);
      expect(booking.slot).toMatchObject({ id: 3, meal: 'lunch' });
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
      const anonymous = await request(app).get('/api/bookings/slot-status?slotId=3');
      expect(anonymous.status).toBe(401);

      await agent.post('/api/auth/login').send({ email: 'hiker@hut.test', password: 'password' });
      const invalid = await agent.get('/api/bookings/slot-status?slotId=invalid');
      expect(invalid.status).toBe(400);
    });

    it('detects an existing booking before review, without changing seat allocation', async () => {
      await agent.post('/api/auth/login').send({ email: 'hiker@hut.test', password: 'password' });
      const before = await agent.get('/api/bookings/slot-status?slotId=3');
      expect(before.status).toBe(200);
      expect(before.body).toEqual({ alreadyBooked: false });

      const created = await agent.post('/api/bookings').send({ slotId: 3, partySize: 2 });
      expect(created.status).toBe(201);

      const after = await agent.get('/api/bookings/slot-status?slotId=3');
      expect(after.status).toBe(200);
      expect(after.body).toEqual({ alreadyBooked: true });

      // The POST still independently protects the booking from duplicate submissions.
      const duplicate = await agent.post('/api/bookings').send({ slotId: 3, partySize: 2 });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('BOOKING_ALREADY_EXISTS');
    });
  });

  describe('Authentication requirements', () => {
    
    it('should return 401 when trying to create a booking without being logged in', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({ slotId: 3, partySize: 2 });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should return 401 when trying to fetch a booking without being logged in', async () => {
      const response = await request(app)
        .get('/api/bookings/1');

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
          slotId: 3,
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