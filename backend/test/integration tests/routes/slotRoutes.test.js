import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

describe('SlotRoutes - Integration Tests', () => {
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

  describe('Authentication & Authorization checks', () => {

    it('should return 401 Unauthorized when trying to access slots endpoints without logging in', async () => {
      const response = await request(app).get('/api/slots');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should return 403 Forbidden when an unprivileged user (e.g., hiker) tries to access slot management', async () => {
      // Log in as a hiker (non-staff role)
      await agent
        .post('/api/auth/login')
        .send({ email: 'hiker@hut.test', password: 'password' });

      const response = await agent.get('/api/slots');
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

  });

 describe('Staff slot operations (POST /api/slots, GET /api/slots, GET /api/slots/:slotId)', () => {

    beforeEach(async () => {
      // Log in as an employee/staff member from seed data
      await agent
        .post('/api/auth/login')
        .send({ email: 'employee@hut.test', password: 'password' });
    });

    it('should allow staff to create a new slot and return 201 with Location header', async () => {
      const newSlotPayload = {
        date: '2026-11-20',
        meal: 'lunch',
        startTime: '12:00',
        startTime: '12:00', // (nota: assicurati di usare startTime e endTime distinti!)
        endTime: '14:00'
      };

      const response = await agent
        .post('/api/slots')
        .send({
          date: '2026-11-20',
          meal: 'lunch',
          startTime: '12:00',
          endTime: '14:00'
        });

      expect(response.status).toBe(201);
      expect(response.header).toHaveProperty('location');
      expect(response.body).toHaveProperty('id');
    });
    
    it('should allow staff to list slots', async () => {
      const response = await agent
        .get('/api/slots')
        .query({ date: '2026-11-20' });

      expect(response.status).toBe(200);
      // Check if it's an array directly or wrapped in an object property (e.g. response.body.slots or response.body)
      const slotsList = Array.isArray(response.body) ? response.body : response.body.slots;
      expect(Array.isArray(slotsList)).toBe(true);
    });

    it('should allow staff to retrieve a specific slot by ID', async () => {
      // Assuming slot ID 1 exists in the seed data
      const slotId = 1;

      const response = await agent
        .get(`/api/slots/${slotId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', slotId);
    });

    it('should return 404 when retrieving a non-existent slot ID', async () => {
      const response = await agent
        .get('/api/slots/999999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

  });

});