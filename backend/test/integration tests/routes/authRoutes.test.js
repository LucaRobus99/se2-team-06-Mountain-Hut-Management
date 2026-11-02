import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

describe('AuthRoutes - Integration Tests', () => {
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

  describe('POST /api/auth/login', () => {
    
    it('should successfully login with valid credentials from seed data', async () => {
      // Attempt login with Hanna Hiker credentials
      const response = await agent
        .post('/api/auth/login')
        .send({
          email: 'hiker@hut.test',
          password: 'password'
        });

      expect(response.status).toBe(200);
      // Check properties inside response.body.user
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'hiker@hut.test');
      expect(response.body.user).toHaveProperty('role', 'hiker');
    });

    it('should return 401 Unauthorized when logging in with an incorrect password', async () => {
      const response = await agent
        .post('/api/auth/login')
        .send({
          email: 'hiker@hut.test',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
    });

    it('should return 401 Unauthorized when logging in with a non-existent email', async () => {
      const response = await agent
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@hut.test',
          password: 'password'
        });

      expect(response.status).toBe(401);
    });

  });

  describe('POST /api/auth/logout', () => {
    
    it('should successfully log out an authenticated user', async () => {
      // Step 1: Log in first
      const loginResponse = await agent
        .post('/api/auth/login')
        .send({
          email: 'hiker@hut.test',
          password: 'password'
        });

      expect(loginResponse.status).toBe(200);

      // Step 2: Log out using the same agent
      const logoutResponse = await agent
        .post('/api/auth/logout');

      // Depending on implementation, logout typically returns 200 or 204
      expect([200, 204]).toContain(logoutResponse.status);
    });

  });

});