import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

describe('SlotRoutes - Integration Tests', () => {
  let db;
  let app;
  let agent;

  beforeEach(() => {
    // Initialize a clean test database (PostgreSQL) with schema and seed data
    db = createTestDb();
    // Create the Express app injecting the test database
    // A fixed clock keeps the fixture date/time valid regardless of when tests run.
    app = createApp({ db, timeZone: 'Europe/Rome', now: () => new Date('2026-11-20T08:00:00Z') });
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

    it('lists reusable time patterns and fixed tables, supports adding a table and rejects changing its capacity', async () => {
      const catalog = await agent.get('/api/slots/catalog');
      expect(catalog.status).toBe(200);
      expect(catalog.body.tables).toContainEqual({ tableId: 1, tableIdentifier: 'T1', seats: 2 });
      expect(catalog.body.timePatterns).toContainEqual({ meal: 'lunch', startTime: '12:00', endTime: '13:00' });
      const created = await agent.post('/api/slots/tables').send({ tableIdentifier: 'Terrace 1', seats: 6 });
      expect(created.status).toBe(201);
      expect((await agent.post('/api/slots/tables').send({ tableIdentifier: 'Terrace 1', seats: 8 })).status).toBe(409);
      const first = { date: '2026-11-20', meal: 'lunch', startTime: '12:00', endTime: '13:00' };
      const valid = await agent.post('/api/slots').send({ ...first, tables: [{ tableIdentifier: 'Terrace 1', seats: 6 }] });
      expect(valid.status).toBe(201);
      const second = { ...first, startTime: '13:00', endTime: '14:00' };
      const invalid = await agent.post('/api/slots').send({ ...second, tables: [{ tableIdentifier: 'Terrace 1', seats: 8 }] });
      expect(invalid.status).toBe(409);
      expect(invalid.body.error.code).toBe('TABLE_CAPACITY_MISMATCH');
      expect((await agent.get('/api/slots').query({ date: first.date })).body.slots).toHaveLength(1);
      await expect(db.query('INSERT INTO slot_tables (slot_id, table_id, seats) VALUES ($1,1,8)', [valid.body.id])).rejects.toThrow();
      expect((await agent.post('/api/slots').send({ ...second, tables: [{ tableIdentifier: 'Terrace 1', seats: 6 }] })).status).toBe(201);
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
