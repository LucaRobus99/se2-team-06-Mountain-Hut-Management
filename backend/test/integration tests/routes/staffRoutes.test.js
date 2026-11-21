import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

describe('StaffRoutes - Integration Tests', () => {
  let db;
  let app;
  let agent;

  const fixedNow = new Date('2026-11-15T08:00:00Z');

  beforeEach(() => {
    db = createTestDb();
    app = createApp({
      db,
      timeZone: 'Europe/Rome',
      now: () => fixedNow,
    });
    agent = request.agent(app);
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Authentication & Authorization checks', () => {
    it('should return 401 Unauthorized when accessing staff endpoints without logging in', async () => {
      const response = await request(app).get('/api/staff/hikers?query=hanna');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should return 403 Forbidden when a non-staff user (e.g., hiker) accesses staff endpoints', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'hiker@hut.test', password: 'password' });

      const getRes = await agent.get('/api/staff/availability?date=2026-11-15&meal=lunch&partySize=2');
      expect(getRes.status).toBe(403);
      expect(getRes.body.error.code).toBe('FORBIDDEN');

      const postRes = await agent.post('/api/staff/bookings').send({
        mode: 'guest',
        slotId: 3,
        partySize: 2,
        contactName: 'Walk-in Guest',
      });
      expect(postRes.status).toBe(403);
      expect(postRes.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Staff endpoints (GET /hikers, GET /availability, GET /availability/:slotId/seating, POST /bookings)', () => {
    beforeEach(async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'employee@hut.test', password: 'password' });
    });

    it('should search hikers using query or q parameter and handle invalid query errors', async () => {
      const resByQuery = await agent.get('/api/staff/hikers').query({ query: 'hanna' });
      expect(resByQuery.status).toBe(200);
      expect(Array.isArray(resByQuery.body.hikers)).toBe(true);

      const resByQ = await agent.get('/api/staff/hikers').query({ q: 'hanna' });
      expect(resByQ.status).toBe(200);
      expect(Array.isArray(resByQ.body.hikers)).toBe(true);

      const invalidRes = await agent.get('/api/staff/hikers').query({ query: 'a' });
      expect([400, 422]).toContain(invalidRes.status);
      expect(invalidRes.body).toHaveProperty('error');
    });

    it('should return staff availability slots including slots within 2 hours and handle invalid params', async () => {
      const response = await agent.get('/api/staff/availability').query({
        date: '2026-11-15',
        meal: 'lunch',
        partySize: 2,
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.slots)).toBe(true);

      const invalidRes = await agent.get('/api/staff/availability').query({
        date: 'not-a-date',
        partySize: 2,
      });
      expect([400, 422]).toContain(invalidRes.status);
      expect(invalidRes.body).toHaveProperty('error');
    });

    it('should return seating info for a valid slotId and handle a non-existent slotId', async () => {
      const okRes = await agent
        .get('/api/staff/availability/3/seating')
        .query({ partySize: 2 });
      expect(okRes.status).toBe(200);

      const missingRes = await agent
        .get('/api/staff/availability/999999/seating')
        .query({ partySize: 2 });
      expect([404, 422]).toContain(missingRes.status);
      expect(missingRes.body).toHaveProperty('error');
    });

    it('should create a guest staff booking with 201 and Location header without no-store', async () => {
      const response = await agent.post('/api/staff/bookings').send({
        mode: 'guest',
        slotId: 3,
        partySize: 2,
        contactName: 'Walk-in Guest',
        email: 'guest@hut.test',
        contactNumber: '+393331234567',
      });

      expect(response.status).toBe(201);
      expect(response.header).toHaveProperty('location');
      expect(response.header.location).toMatch(/^\/api\/bookings\/\d+$/);
      expect(response.headers['cache-control']).not.toBe('no-store');
      expect(response.body).toHaveProperty('id');
    });

    it('should create an existingHiker staff booking with 201 and Location header', async () => {
      const response = await agent.post('/api/staff/bookings').send({
        mode: 'existingHiker',
        slotId: 11,
        partySize: 2,
        hikerId: 3,
      });

      expect(response.status).toBe(201);
      expect(response.header).toHaveProperty('location');
      expect(response.header.location).toMatch(/^\/api\/bookings\/\d+$/);
      expect(response.headers['cache-control']).not.toBe('no-store');
      expect(response.body).toHaveProperty('id');
    });

    it('should set Cache-Control: no-store when creating a newHiker booking with initialPassword', async () => {
      const response = await agent.post('/api/staff/bookings').send({
        mode: 'newHiker',
        slotId: 3,
        partySize: 2,
        name: 'Nuovo Escursionista',
        email: 'nuovo.escursionista@hut.test',
        phone: '+393339876543',
      });

      expect(response.status).toBe(201);
      expect(response.header).toHaveProperty('location');
      expect(response.header.location).toMatch(/^\/api\/bookings\/\d+$/);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toHaveProperty('initialPassword');
    });

    it('should propagate validation/domain errors on POST /api/staff/bookings', async () => {
      const response = await agent.post('/api/staff/bookings').send({
        mode: 'invalidMode',
        slotId: 3,
        partySize: 2,
      });

      expect([400, 404, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });
  });
});