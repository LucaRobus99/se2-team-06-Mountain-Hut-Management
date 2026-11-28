import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

describe('MenuRoutes - Integration Tests', () => {
  let db;
  let app;
  let agent;
  let futureSlotId;
  let pastSlotId;

  beforeEach(async () => {
    // Initialize a clean test database (PostgreSQL) with schema and seed data
    db = createTestDb();
    // Create the Express app injecting the test database
    app = createApp({ db });
    // Create a Supertest agent to maintain session cookies across requests
    agent = request.agent(app);

    // Create a future slot for menu assignment and future-slot deletion tests
    const futureSlotRes = await db.query(
      `INSERT INTO slots (meal_id, date, start_time, end_time, status)
       VALUES (2, '2027-06-15', '12:00', '13:00', 'available') RETURNING id`
    );
    futureSlotId = futureSlotRes.rows[0].id;

    // Create a past slot to verify menu deletion blocking when referenced by past slots
    const pastSlotRes = await db.query(
      `INSERT INTO slots (meal_id, date, start_time, end_time, status)
       VALUES (2, '2024-05-10', '12:00', '13:00', 'available') RETURNING id`
    );
    pastSlotId = pastSlotRes.rows[0].id;
  });

  afterEach(async () => {
    // Close the database connection after each test
    await db.close();
  });

  describe('Authentication and role authorization', () => {
    it('rejects unauthenticated requests with 401 across menu and slot menu endpoints', async () => {
      expect((await request(app).get('/api/menus')).status).toBe(401);
      expect((await request(app).post('/api/menus')).status).toBe(401);
      expect((await request(app).get('/api/menus/1')).status).toBe(401);
      expect((await request(app).put('/api/menus/1')).status).toBe(401);
      expect((await request(app).delete('/api/menus/1')).status).toBe(401);
      expect((await request(app).put(`/api/slots/${futureSlotId}/menu`)).status).toBe(401);
    });

    it('rejects non-staff hiker accounts with 403', async () => {
      await agent.post('/api/auth/login').send({ email: 'hiker@hut.test', password: 'password' });

      const listRes = await agent.get('/api/menus');
      expect(listRes.status).toBe(403);

      const createRes = await agent.post('/api/menus').send({
        mealId: 2,
        name: 'Forbidden Menu',
        content: 'Polenta',
      });
      expect(createRes.status).toBe(403);

      const assignRes = await agent.put(`/api/slots/${futureSlotId}/menu`).send({
        name: 'Ad-hoc',
        content: 'Soup',
      });
      expect(assignRes.status).toBe(403);
    });
  });

  describe('POST /api/menus & GET /api/menus & GET /api/menus/:id', () => {
    it('creates a menu with 201 and Location header, lists menus with filters, and fetches by ID', async () => {
      const loginRes = await agent.post('/api/auth/login').send({ email: 'employee@hut.test', password: 'password' });
      expect(loginRes.status).toBe(200);

      const createRes = await agent.post('/api/menus').send({
        mealId: 2,
        name: 'Alpine Lunch Menu',
        content: 'Polenta concia e cervo',
      });
      expect(createRes.status).toBe(201);
      expect(createRes.header).toHaveProperty('location', `/api/menus/${createRes.body.id}`);
      expect(createRes.body).toMatchObject({
        id: createRes.body.id,
        mealId: 2,
        name: 'Alpine Lunch Menu',
        content: 'Polenta concia e cervo',
      });

      const allRes = await agent.get('/api/menus');
      expect(allRes.status).toBe(200);
      expect(Array.isArray(allRes.body)).toBe(true);
      expect(allRes.body.some((m) => m.id === createRes.body.id)).toBe(true);

      const filteredByMeal = await agent.get('/api/menus').query({ meal: 'lunch' });
      expect(filteredByMeal.status).toBe(200);
      expect(filteredByMeal.body.some((m) => m.id === createRes.body.id)).toBe(true);

      const filteredByMealId = await agent.get('/api/menus').query({ mealId: 2 });
      expect(filteredByMealId.status).toBe(200);
      expect(filteredByMealId.body.some((m) => m.id === createRes.body.id)).toBe(true);

      const getRes = await agent.get(`/api/menus/${createRes.body.id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body).toMatchObject({
        id: createRes.body.id,
        name: 'Alpine Lunch Menu',
      });
    });

    it('returns 404 when fetching a non-existent menu ID', async () => {
      await agent.post('/api/auth/login').send({ email: 'employee@hut.test', password: 'password' });

      const res = await agent.get('/api/menus/999999');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/menus/:id - Update menu', () => {
    it('updates menu name and content for an authenticated staff user', async () => {
      await agent.post('/api/auth/login').send({ email: 'employee@hut.test', password: 'password' });

      const createRes = await agent.post('/api/menus').send({
        mealId: 4,
        name: 'Dinner Base',
        content: 'Canederli in brodo',
      });
      expect(createRes.status).toBe(201);
      const menuId = createRes.body.id;

      const updateRes = await agent.put(`/api/menus/${menuId}`).send({
        name: 'Dinner Updated',
        content: 'Canederli allo speck',
      });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body).toMatchObject({
        id: menuId,
        name: 'Dinner Updated',
        content: 'Canederli allo speck',
      });
    });

    it('returns 404 when updating a non-existent menu ID', async () => {
      await agent.post('/api/auth/login').send({ email: 'employee@hut.test', password: 'password' });

      const res = await agent.put('/api/menus/999999').send({
        name: 'Missing Menu',
        content: 'Nothing',
      });
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/menus/:id - Delete menu', () => {
    it('deletes an unreferenced menu with 204 and releases referencing future slots', async () => {
      await agent.post('/api/auth/login').send({ email: 'employee@hut.test', password: 'password' });

      const createRes = await agent.post('/api/menus').send({
        mealId: 2,
        name: 'Future Slot Menu',
        content: 'Strudel',
      });
      expect(createRes.status).toBe(201);
      const menuId = createRes.body.id;

      await agent.put(`/api/slots/${futureSlotId}/menu`).send({ menuId });

      const deleteRes = await agent.delete(`/api/menus/${menuId}`);
      expect(deleteRes.status).toBe(204);

      const { rows } = await db.query('SELECT menu_id FROM slots WHERE id = $1', [futureSlotId]);
      expect(rows[0].menu_id).toBeNull();
    });

    it('blocks deletion with 409 when the menu is referenced by a past slot', async () => {
      await agent.post('/api/auth/login').send({ email: 'employee@hut.test', password: 'password' });

      const createRes = await agent.post('/api/menus').send({
        mealId: 2,
        name: 'Historical Menu',
        content: 'Polenta e salsiccia',
      });
      expect(createRes.status).toBe(201);
      const menuId = createRes.body.id;

      await db.query('UPDATE slots SET menu_id = $1 WHERE id = $2', [menuId, pastSlotId]);

      const deleteRes = await agent.delete(`/api/menus/${menuId}`);
      expect(deleteRes.status).toBe(409);
      expect(deleteRes.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/slots/:slotId/menu - Assign menu to slot', () => {
    it('assigns a menu from the library and then replaces it with an ad-hoc menu', async () => {
      await agent.post('/api/auth/login').send({ email: 'employee@hut.test', password: 'password' });

      const createRes = await agent.post('/api/menus').send({
        mealId: 2,
        name: 'Hut Special',
        content: 'Goulash',
      });
      expect(createRes.status).toBe(201);
      const menuId = createRes.body.id;

      const assignLibraryRes = await agent.put(`/api/slots/${futureSlotId}/menu`).send({
        menuId,
      });
      expect(assignLibraryRes.status).toBe(200);
      expect(assignLibraryRes.body).toMatchObject({
        slotId: futureSlotId,
        menuId,
      });

      const assignOverrideRes = await agent.put(`/api/slots/${futureSlotId}/menu`).send({
        name: 'Custom Table Menu',
        content: 'Tagliatelle al ragù',
      });
      expect(assignOverrideRes.status).toBe(200);

      const { rows } = await db.query(
        `SELECT menu_id, menu_name_override, menu_content_override
         FROM slots WHERE id = $1`,
        [futureSlotId]
      );
      expect(rows[0]).toEqual({
        menu_id: null,
        menu_name_override: 'Custom Table Menu',
        menu_content_override: 'Tagliatelle al ragù',
      });
    });
  });
});