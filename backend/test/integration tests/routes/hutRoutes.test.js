import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

describe('HutRoutes - Integration Tests', () => {
  let db;
  let app;

  beforeEach(() => {
    // Initialize a clean in-memory SQLite database with schema and seed data
    db = createTestDb();
    // Create the Express app injecting the test database
    app = createApp({ db });
  });

  afterEach(async () => {
    // Close the database connection after each test
    await db.close();
  });

  describe('GET /api/huts/:hutId/slots', () => {
    
    it('should return available slots for a given hut, date, meal, and partySize', async () => {
      // In the seed data, hut 1 has lunch slots on '2026-11-15' that can seat partySize 2
      const response = await request(app)
        .get('/api/huts/1/slots')
        .query({ date: '2026-11-15', meal: 'lunch', partySize: 2 });

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Object);
      expect(response.body.slots).toBeInstanceOf(Array);
      expect(response.body.slots.length).toBeGreaterThan(0);
      
      // Verify slot properties
      expect(response.body.slots[0]).toHaveProperty('id');
      expect(response.body.slots[0]).toHaveProperty('startTime');
    });

    it('should return 200 with an empty slots array if no slots are available for a future date', async () => {
      const response = await request(app)
        .get('/api/huts/1/slots')
        .query({ date: '2099-01-01', meal: 'lunch', partySize: 2 });

      expect(response.status).toBe(200);
      expect(response.body.slots).toEqual([]);
    });

  });

  describe('GET /api/huts/:hutId/slots/:slotId/seating', () => {
    
    it('should return seating availability for a valid slot', async () => {
      // In the seed data, slot ID 3 belongs to hut 1 ('2026-11-15 12:00')
      const response = await request(app)
        .get('/api/huts/1/slots/3/seating')
        .query({ partySize: 2 });

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body).toHaveProperty('hutId', 1);
      expect(response.body).toHaveProperty('slotId', 3);
      expect(response.body).toHaveProperty('seatAssignments');
    });

  });

});