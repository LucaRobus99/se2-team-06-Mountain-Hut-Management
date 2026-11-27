import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestDb } from './helpers/testDb.js';

const fixedNow = () => new Date('2026-11-02T10:00:00Z');

async function login(app, role) {
  const agent = request.agent(app);
  expect((await agent.post('/api/auth/login').send({ email: `${role}@hut.test`, password: 'password' })).status).toBe(200);
  return agent;
}

describe('Staff catalog table removal', () => {
  it('deletes an unused table and rejects removal of a referenced table', async () => {
    const db = createTestDb();
    try {
      const app = createApp({ db, now: fixedNow });
      const agent = await login(app, 'employee');
      const catalog = await agent.get('/api/slots/catalog');
      expect(catalog.status).toBe(200);
      expect(Array.isArray(catalog.body.tables)).toBe(true);
      expect(Array.isArray(catalog.body.timePatterns)).toBe(true);
      const unused = await agent.post('/api/slots/tables').send({ tableIdentifier: 'Removal test', seats: 4 });
      expect(unused.status).toBe(201);
      const path = `/api/slots/tables/${unused.body.tableId}`;
      expect((await agent.delete(path)).status).toBe(204);
      expect((await agent.get('/api/slots/catalog')).body.tables.some(t => t.tableId === unused.body.tableId)).toBe(false);
      expect((await agent.delete(path)).status).toBe(404);
      const used = await agent.post('/api/slots/tables').send({ tableIdentifier: 'Referenced table test', seats: 4 });
      expect(used.status).toBe(201);
      const slot = await agent.post('/api/slots').send({ date: '2026-11-18', meal: 'dinner', startTime: '11:30', endTime: '12:15', tables: [{ tableIdentifier: 'Referenced table test', seats: 4 }] });
      expect(slot.status).toBe(201);
      const rejected = await agent.delete(`/api/slots/tables/${used.body.tableId}`);
      expect(rejected.status).toBe(409);
      expect(rejected.body.error.code).toBe('TABLE_IN_USE');
      expect((await agent.get(`/api/slots/${slot.body.id}`)).body.tables).toEqual(slot.body.tables);
    } finally { await db.close(); }
  });

  it('restricts removal to staff and validates identifiers', async () => {
    const db = createTestDb();
    try {
      const app = createApp({ db, now: fixedNow });
      expect((await request(app).delete('/api/slots/tables/1')).status).toBe(401);
      const hiker = await login(app, 'hiker');
      expect((await hiker.delete('/api/slots/tables/1')).status).toBe(403);
      const staff = await login(app, 'warden');
      expect((await staff.delete('/api/slots/tables/invalid')).status).toBe(400);
    } finally { await db.close(); }
  });
});
