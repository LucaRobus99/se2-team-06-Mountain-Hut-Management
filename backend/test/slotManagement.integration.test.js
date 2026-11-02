import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createSqliteDb } from '../src/db/sqlite.js';

const fixedNow = () => new Date('2026-11-02T10:00:00Z');
const payload = { date: '2026-11-18', startTime: '11:30', endTime: '12:15', meal: 'dinner', tables: [{ tableIdentifier: 'T1', seats: 3 }, { tableIdentifier: 'T6', seats: 5 }] };

async function context(role = 'employee') {
  const db = createSqliteDb(':memory:');
  const app = createApp({ db, now: fixedNow });
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').send({ email: `${role}@hut.test`, password: 'password' });
  expect(response.status).toBe(200);
  return { db, app, agent };
}

describe('MH-02 staff slot configuration', () => {
  it('allows a meal category at any time and exposes it in public availability', async () => {
    const { db, app, agent } = await context();
    try {
      const created = await agent.post('/api/slots').send(payload);
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ meal: 'dinner', startTime: '11:30', endTime: '12:15' });
      expect(created.body.tables.map((t) => t.seats)).toEqual([3, 5]);
      const publicAvailability = await request(app).get('/api/availability').query({ date: payload.date, meal: 'dinner', partySize: 8 });
      expect(publicAvailability.status).toBe(200);
      expect(publicAvailability.body.slots.some((slot) => slot.id === created.body.id)).toBe(true);
      const listing = await agent.get('/api/slots').query({ date: payload.date });
      expect(listing.status).toBe(200);
      expect(listing.body.slots.some((slot) => slot.id === created.body.id && slot.meal === 'dinner')).toBe(true);
    } finally { await db.close(); }
  });

  it('copies table seats independently of its source meal and date', async () => {
    const { db, agent } = await context();
    try {
      const created = await agent.post('/api/slots').send({ date:'2026-11-18', startTime:'15:00', endTime:'16:00', meal:'breakfast', copyTablesFromSlotId:3 });
      expect(created.status).toBe(201);
      const source = await agent.get('/api/slots/3');
      expect(created.body.meal).toBe('breakfast');
      expect(created.body.tables.map(({tableIdentifier,seats})=>[tableIdentifier,seats])).toEqual(source.body.tables.map(({tableIdentifier,seats})=>[tableIdentifier,seats]));
    } finally { await db.close(); }
  });

  it('rejects invalid configurations and overlapping slots', async () => {
    const { db, agent } = await context();
    try {
      const missingMeal = await agent.post('/api/slots').send({ ...payload, meal: undefined });
      expect(missingMeal.status).toBe(400);
      const created = await agent.post('/api/slots').send(payload);
      expect(created.status).toBe(201);
      const overlap = await agent.post('/api/slots').send({ ...payload, startTime:'12:00',endTime:'13:00' });
      expect(overlap.status).toBe(409);
      expect(overlap.body.error.code).toBe('SLOT_OVERLAP');
    } finally { await db.close(); }
  });

  it('protects staff routes from unauthenticated visitors and hikers', async () => {
    const db = createSqliteDb(':memory:');
    try {
      const app = createApp({ db, now: fixedNow });
      expect((await request(app).post('/api/slots').send(payload)).status).toBe(401);
      const hiker = request.agent(app);
      expect((await hiker.post('/api/auth/login').send({ email:'hiker@hut.test',password:'password' })).status).toBe(200);
      expect((await hiker.post('/api/slots').send(payload)).status).toBe(403);
      expect((await hiker.get('/api/slots').query({ date:payload.date })).status).toBe(403);
    } finally { await db.close(); }
  });
});
