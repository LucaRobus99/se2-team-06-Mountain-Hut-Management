import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createTestDb } from '../helpers/dbHelper.js';

// Minimal valid PNG header is sufficient for a persistence/transport test; the
// application checks magic bytes rather than decoding the image server-side.
const tinyPng = 'data:image/png;base64,' + Buffer.from('89504e470d0a1a0a0000000049454e44ae426082', 'hex').toString('base64');

describe('My Account — authenticated profile and security', () => {
  let db, app, hiker;
  beforeEach(async () => {
    db = createTestDb();
    app = createApp({ db });
    hiker = request.agent(app);
    const response = await hiker.post('/api/auth/login').send({ email:'hiker@hut.test', password:'password' });
    expect(response.status).toBe(200);
  });
  afterEach(async () => { await db.close(); });

  it('returns editable hiker fields without exposing the password hash', async () => {
    const result = await hiker.get('/api/auth/me');
    expect(result.status).toBe(200);
    expect(result.body.user).toMatchObject({ role:'hiker', email:'hiker@hut.test', avatarUrl:null });
    expect(result.body.user).not.toHaveProperty('password_hash');
  });

  it('persists name, mandatory phone, optional notes and emergency contact', async () => {
    const edited = await hiker.patch('/api/auth/me').send({
      name:'Another Hiker', phone:'+39 333 1112222', notes:'Mountain guide', emergencyContact:'Sam +39 3210000000',
    });
    expect(edited.status).toBe(200);
    const fresh = await hiker.get('/api/auth/me');
    expect(fresh.body.user).toMatchObject({
      displayName:'Another Hiker', phone:'+39 333 1112222', notes:'Mountain guide',
      emergencyContact:'Sam +39 3210000000', email:'hiker@hut.test',
    });
    const stored = await db.query('SELECT notes, emergency_contact FROM users WHERE id = $1', [3]);
    expect(stored.rows[0].notes).toBe('Mountain guide');
  });

  it('rejects invalid phone numbers, empty names and attempts to edit the email', async () => {
    expect((await hiker.patch('/api/auth/me').send({ phone:'123' })).status).toBe(400);
    expect((await hiker.patch('/api/auth/me').send({ name:'  ' })).status).toBe(400);
    expect((await hiker.patch('/api/auth/me').send({ email:'attacker@example.com' })).status).toBe(400);
  });

  it('verifies the current password and preserves valid sessions after changing it', async () => {
    const failed = await hiker.post('/api/auth/change-password').send({ currentPassword:'incorrect', newPassword:'longnewpassword!' });
    expect(failed.status).toBe(400);
    expect(failed.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    expect((await hiker.post('/api/auth/change-password').send({ currentPassword:'password', newPassword:'longnewpassword!' })).status).toBe(204);
    expect((await hiker.get('/api/auth/me')).status).toBe(200);
    const freshAgent = request.agent(app);
    expect((await freshAgent.post('/api/auth/login').send({ email:'hiker@hut.test', password:'password' })).status).toBe(401);
    expect((await freshAgent.post('/api/auth/login').send({ email:'hiker@hut.test', password:'longnewpassword!' })).status).toBe(200);
  });

  it('uploads and serves only this account avatar and removes it', async () => {
    const upload = await hiker.patch('/api/auth/avatar').send({ imageData: tinyPng });
    expect(upload.status).toBe(200);
    expect(upload.body.user.avatarUrl).toMatch(/^\/api\/auth\/avatar\?v=\d+$/);
    const image = await hiker.get('/api/auth/avatar');
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toMatch(/^image\/png/);
    expect((await hiker.delete('/api/auth/avatar')).body.user.avatarUrl).toBe(null);
    expect((await hiker.get('/api/auth/avatar')).status).toBe(404);
  });

  it('keeps profile photos private to the signed-in user', async () => {
    const upload = await hiker.patch('/api/auth/avatar').send({ imageData:tinyPng });
    expect(upload.status).toBe(200);
    const another = request.agent(app);
    const created = await another.post('/api/auth/register').send({
      name:'Second Hiker', email:'second@hut.test', phone:'+39 333 1234567', password:'securepassword',
    });
    expect(created.status).toBe(201);
    expect((await another.get('/api/auth/avatar')).status).toBe(404);
    expect((await another.get('/api/auth/me')).body.user.avatarUrl).toBe(null);
  });

  it('does not let staff edit hiker-specific profile fields', async () => {
    const employee = request.agent(app);
    expect((await employee.post('/api/auth/login').send({ email:'employee@hut.test', password:'password' })).status).toBe(200);
    expect((await employee.patch('/api/auth/me').send({ name:'Changed employee' })).status).toBe(403);
    expect((await employee.patch('/api/auth/avatar').send({ imageData:tinyPng })).status).toBe(403);
  });

  it('rejects fake image data and unauthorized profile changes', async () => {
    expect((await hiker.patch('/api/auth/avatar').send({ imageData:'data:image/png;base64,' + Buffer.from('not a png').toString('base64') })).status).toBe(400);
    expect((await request(app).patch('/api/auth/me').send({ name:'x' })).status).toBe(401);
    expect((await request(app).patch('/api/auth/avatar').send({ imageData:tinyPng })).status).toBe(401);
  });
});
