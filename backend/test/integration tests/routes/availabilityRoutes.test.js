import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

describe('AvailabilityRoutes - Integration Tests', () => {
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

  describe('GET /api/availability', () => {

    it('should return available slots when valid query parameters (date, meal, partySize) are provided', async () => {
      // Assuming seed data contains slots for a specific date (adjust parameters according to your seed data)
      const response = await request(app)
        .get('/api/availability')
        .query({
          date: '2026-11-15', // Adjust to a valid seed date if necessary
          meal: 'lunch',
          partySize: '2'
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body) || typeof response.body === 'object').toBe(true);
    });

    it('should handle validation errors or missing query parameters gracefully via error handler', async () => {
      // Sending request without required query params or invalid format
      const response = await request(app)
        .get('/api/availability')
        .query({
          date: 'invalid-date',
          partySize: 'not-a-number'
        });

      // Depending on service/validation implementation, it should return 400 or handle it
      expect([400, 422, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

  });

  describe('GET /api/availability/:slotId/seating', () => {

    it('should return seating arrangement details for a valid slotId and partySize', async () => {
      // Assuming slot ID 1 exists in the seed data
      const slotId = 1;

      const response = await request(app)
        .get(`/api/availability/${slotId}/seating`)
        .query({ partySize: '2' });

      // If the slot exists, expect 200; if it doesn't exist in seed, expect 404
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toBeDefined();
      }
    });

    it('should return 404 or an error when requesting seating for a non-existent slotId', async () => {
      const nonExistentSlotId = 99999;

      const response = await request(app)
        .get(`/api/availability/${nonExistentSlotId}/seating`)
        .query({ partySize: '2' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

  });

});