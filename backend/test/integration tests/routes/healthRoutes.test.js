import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

describe('HealthRoutes - Integration Tests', () => {
  let db;
  let app;

  beforeEach(() => {
    // Initialize a clean in-memory SQLite database
    db = createTestDb();
    // Create the Express app injecting the test database
    app = createApp({ db });
  });

  afterEach(async () => {
    // Close the database connection after each test (safely handling already closed connections)
    try {
      await db.close();
    } catch {
      // Ignore error if the database was closed during the test
    }
  });

  describe('GET /api/health', () => {
    
    it('should return status UP and database UP when the database is reachable', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'UP',
        database: 'UP',
      });
    });

    it('should return status 503 and database DOWN when the database is unreachable', async () => {
      // Close the database connection prematurely to simulate a database failure
      await db.close();

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        status: 'DOWN',
        database: 'DOWN',
      });
    });

  });

});