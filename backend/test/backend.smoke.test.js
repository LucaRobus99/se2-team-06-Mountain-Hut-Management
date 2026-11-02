import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createSqliteDb } from '../src/db/sqlite.js';

describe('Backend smoke tests', () => {
  it('creates the schema and seed data in an in-memory SQLite database', async () => {
    const db = createSqliteDb(':memory:');

    try {
      const { rows: tables } = await db.query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );
      expect(tables.map((t) => t.name)).toEqual([
        'booking_seats', 'bookings', 'dining_tables', 'meals', 'menus', 'slot_tables', 'slots', 'users',
      ]);

      const { rows: staff } = await db.query(
        "SELECT role FROM users WHERE role <> 'hiker' ORDER BY role"
      );
      expect(staff).toEqual([
        { role: 'employee' },
        { role: 'warden' },
      ]);
    } finally {
      await db.close();
    }
  });

  it('responds to GET /api/health with database UP', async () => {
    const db = createSqliteDb(':memory:');

    try {
      const response = await request(createApp({ db })).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'UP', database: 'UP' });
    } finally {
      await db.close();
    }
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const db = createSqliteDb(':memory:');

    try {
      const response = await request(createApp({ db })).get('/api/unknown');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { code: 'NOT_FOUND', message: 'No route for GET /api/unknown' },
      });
    } finally {
      await db.close();
    }
  });
});
