import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

describe('AuthRoutes - Integration Tests (Extended Coverage)', () => {
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
      const response = await agent
        .post('/api/auth/login')
        .send({
          email: 'hiker@hut.test',
          password: 'password'
        });

      expect(response.status).toBe(200);
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
      const loginResponse = await agent
        .post('/api/auth/login')
        .send({
          email: 'hiker@hut.test',
          password: 'password'
        });

      expect(loginResponse.status).toBe(200);

      const logoutResponse = await agent
        .post('/api/auth/logout');

      expect([200, 204]).toContain(logoutResponse.status);
    });

  });

  describe('POST /api/auth/register', () => {

    it('should successfully register a new hiker and sign them in', async () => {
      const newHiker = {
        name: 'New Hiker',
        email: 'newhiker@hut.test',
        phone: '+393331234567',
        password: 'Password123!',
      };

      const response = await agent
        .post('/api/auth/register')
        .send(newHiker);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'newhiker@hut.test');
      expect(response.body.user).toHaveProperty('role', 'hiker');
    });

    it('should return a validation error (400) when registration body is invalid', async () => {
      const invalidHiker = {
        name: '', 
        email: 'invalid-email',
      };

      const response = await request(app) 
        .post('/api/auth/register')
        .send(invalidHiker);

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

  });

  describe('GET /api/auth/me', () => {

    it('should return the currently authenticated user profile', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'hiker@hut.test', password: 'password' });

      const response = await agent.get('/api/auth/me');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'hiker@hut.test');
    });

    it('should return 401 Unauthorized when trying to access /me without being logged in', async () => {
      const unauthAgent = request.agent(app); 
      const response = await unauthAgent.get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty('code', 'UNAUTHENTICATED');
    });

  });

  describe('PATCH /api/auth/me & Profile Management', () => {

    it('should successfully update hiker profile details', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'hiker@hut.test', password: 'password' });

      const response = await agent
        .patch('/api/auth/me')
        .send({
          name: 'Hanna Updated',
          phone: '+393339999999',
          notes: 'Special notes',
          emergencyContact: 'Emergency Contact Person',
        });

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('displayName', 'Hanna Updated');
    });

  });

  describe('Avatar Endpoints (/api/auth/avatar)', () => {

    it('should return 404 when getting avatar for a user without profile photo', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'hiker@hut.test', password: 'password' });

      const response = await agent.get('/api/auth/avatar');
      expect(response.status).toBe(404);
    });

  it('should successfully upload and retrieve an avatar', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'hiker@hut.test', password: 'password' });

      // Invia 'imageData' con il formato base64 corretto richiesto dal validatore
      const uploadRes = await agent
        .patch('/api/auth/avatar')
        .send({
          imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        });

      // Rimuovi o mantieni il log di controllo
      console.log('RISPOSTA /AVATAR:', JSON.stringify(uploadRes.body, null, 2));

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.user).toHaveProperty('avatarUrl');

      // Retrieve avatar
      const getRes = await agent.get('/api/auth/avatar');
      expect(getRes.status).toBe(200);
      expect(getRes.header['content-type']).toContain('image/png');
    });

    

    it('should successfully remove an avatar', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'hiker@hut.test', password: 'password' });

      // First upload
      await agent
        .patch('/api/auth/avatar')
        .send({
          image: Buffer.from('fake-image-data').toString('base64'),
          mime: 'image/png',
        });

      // Then delete
      const deleteRes = await agent.delete('/api/auth/avatar');
      expect(deleteRes.status).toBe(200);
    });

  });

  describe('POST /api/auth/login validation failures', () => {

    it('should return 400 Bad Request when login body fields are missing or invalid format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

  });

});