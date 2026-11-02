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

});