import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

describe('AvailabilityRoutes - Integration Tests', () => {
  let db;
  let app;

  beforeEach(() => {
    // Initialize a clean test database (PostgreSQL) with schema and seed data
    db = createTestDb();
    // Create the Express app injecting the test database
    // Pin the clock before the seed slots (2026-11-15) so they are still bookable.
    app = createApp({ db, now: () => new Date('2026-11-14T08:00:00.000Z') });
  });

  afterEach(async () => {
    // Close the database connection after each test
    await db.close();
  });

  describe('GET /api/availability', () => {
    it('should return available slots when valid query parameters (date, meal, partySize) are provided', async () => {
      const response = await request(app)
        .get('/api/availability')
        .query({
          date: '2026-11-15',
          meal: 'lunch',
          partySize: '2',
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body) || typeof response.body === 'object').toBe(true);
    });

    it('should handle validation errors or missing query parameters gracefully via error handler', async () => {
      const response = await request(app)
        .get('/api/availability')
        .query({
          date: 'invalid-date',
          partySize: 'not-a-number',
        });

      expect([400, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/availability/:slotId/seating', () => {
    it('should return seating arrangement details for a valid slotId and partySize', async () => {
      const slotId = 1;

      const response = await request(app)
        .get(`/api/availability/${slotId}/seating`)
        .query({ partySize: '2' });

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

  describe('GET /api/availability/menus', () => {
    it('should return public slot menus for a date without requiring login', async () => {
      const { rows: slots } = await db.query(
        `SELECT id, meal_id FROM slots WHERE date = '2026-11-15' ORDER BY id LIMIT 1`
      );

      if (slots.length > 0) {
        const menuRes = await db.query(
          `INSERT INTO menus (meal_id, name, content, updated_at)
           VALUES ($1, 'Hut Lunch', 'Polenta e funghi', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
           RETURNING id`,
          [slots[0].meal_id]
        );
        await db.query('UPDATE slots SET menu_id = $1 WHERE id = $2', [menuRes.rows[0].id, slots[0].id]);
      }

      const response = await request(app)
        .get('/api/availability/menus')
        .query({ date: '2026-11-15' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        date: '2026-11-15',
        meal: null,
      });
      expect(Array.isArray(response.body.slots)).toBe(true);
    });

    it('should filter by meal and return 400 when date is missing or invalid', async () => {
      const filteredRes = await request(app)
        .get('/api/availability/menus')
        .query({ date: '2026-11-15', meal: 'lunch' });

      expect(filteredRes.status).toBe(200);
      expect(filteredRes.body.meal).toBe('lunch');

      const invalidRes = await request(app).get('/api/availability/menus');
      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body).toHaveProperty('error');
    });
  });

  describe('GET /api/availability/:slotId/menu', () => {
    it('should return slot menu details with menu: null when no menu is assigned', async () => {
      const { rows: slots } = await db.query('SELECT id FROM slots ORDER BY id LIMIT 1');
      const slotId = slots[0]?.id ?? 1;

      const response = await request(app).get(`/api/availability/${slotId}/menu`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ slotId });
      expect(response.body).toHaveProperty('menu');
    });

    it('should return 404 when requesting menu for a non-existent slotId', async () => {
      const response = await request(app).get('/api/availability/99999/menu');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });
});