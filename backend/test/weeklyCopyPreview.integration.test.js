import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestDb } from './helpers/testDb.js';

const previewPath = '/api/staff/slots/copy-week/preview';
const copyPath = '/api/staff/slots/copy-week';
const input = { sourceWeekStart: '2026-11-09', targetWeekStart: '2026-11-23' };

async function staff(db) {
  const app = createApp({ db, now: () => new Date('2026-11-02T10:00:00Z') });
  const agent = request.agent(app);
  expect((await agent.post('/api/auth/login').send({ email: 'employee@hut.test', password: 'password' })).status).toBe(200);
  return { app, agent };
}
const confirmedInput = preview => ({ ...input, expectedSourceSlotIds: preview.sourceSlotIds, expectedTargetSlotIds: preview.targetSlotIds });
const signature = ({ startTime, endTime, meal, status, tables }) => ({ startTime, endTime, meal, status, tables: tables.map(({ tableId, seats }) => ({ tableId, seats })) });

describe('MH-09 weekly copy preview', () => {
  it('previews and copies all seven days, including a source containing only Sunday slots', async () => {
    const db = createTestDb();
    try {
      const { agent } = await staff(db);
      const preview = await agent.post(previewPath).send(input);
      expect(preview.status).toBe(200);
      expect(preview.body).toMatchObject({ sourceCount: 7, sourceDays: 1, targetCount: 0, targetSlotIds: [] });
      expect((await agent.get('/api/slots').query({ date: '2026-11-29' })).body.slots).toEqual([]);
      const copied = await agent.post(copyPath).send(confirmedInput(preview.body));
      expect(copied.status).toBe(201);
      expect(copied.body).toEqual({ targetWeekStart: '2026-11-23', copiedCount: 7 });
      const source = await agent.get('/api/slots').query({ date: '2026-11-15' });
      const target = await agent.get('/api/slots').query({ date: '2026-11-29' });
      expect(target.body.slots.map(signature)).toEqual(source.body.slots.map(signature));
      expect(target.body.slots.map(s => s.id)).not.toEqual(source.body.slots.map(s => s.id));
    } finally { await db.close(); }
  });

  it('replaces a non-Monday schedule and rejects a stale confirmation', async () => {
    const db = createTestDb();
    try {
      const { agent } = await staff(db);
      const old = await agent.post('/api/slots').send({ date: '2026-11-28', meal: 'lunch', startTime: '12:00', endTime: '13:00', tables: [{ tableIdentifier: 'T1', seats: 2 }] });
      expect(old.status).toBe(201);
      const preview = await agent.post(previewPath).send(input);
      expect(preview.body).toMatchObject({ targetCount: 1, targetSlotIds: [old.body.id] });
      expect((await agent.post(copyPath).send(confirmedInput(preview.body))).status).toBe(201);
      expect((await agent.get('/api/slots').query({ date: '2026-11-28' })).body.slots).toEqual([]);
      const stale = await agent.post(copyPath).send(confirmedInput(preview.body));
      expect(stale.status).toBe(409);
      expect(stale.body.error.code).toBe('WEEKLY_COPY_CHANGED');
      expect((await agent.get('/api/slots').query({ date: '2026-11-29' })).body.slots).toHaveLength(7);
    } finally { await db.close(); }
  });

  it('blocks a Sunday reservation created after preview without altering the destination', async () => {
    const db = createTestDb();
    try {
      const { agent } = await staff(db);
      const old = await agent.post('/api/slots').send({ date: '2026-11-29', meal: 'lunch', startTime: '12:00', endTime: '13:00', tables: [{ tableIdentifier: 'T1', seats: 2 }] });
      expect(old.status).toBe(201);
      const preview = await agent.post(previewPath).send(input);
      expect(preview.status).toBe(200);
      await db.query("INSERT INTO bookings (slot_id,hiker_id,contact_name,party_size,status) VALUES ($1,3,'Test',1,'confirmed')", [old.body.id]);
      const rejected = await agent.post(copyPath).send(confirmedInput(preview.body));
      expect(rejected.status).toBe(409);
      expect(rejected.body.error.code).toBe('WEEKLY_COPY_CONFLICT');
      expect((await agent.post(previewPath).send(input)).status).toBe(409);
      expect((await agent.get('/api/slots').query({ date: '2026-11-29' })).body.slots.map(s => s.id)).toEqual([old.body.id]);
    } finally { await db.close(); }
  });
});
