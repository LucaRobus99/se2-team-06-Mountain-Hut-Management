// Isolated MH-06 browser-test server. Never uses a local database or real Mailgun.
import express from 'express';
import { createDb } from '../src/db/index.js';

process.env.NODE_ENV = 'test';
process.env.MAILGUN_API_KEY = '';
process.env.API_KEY = '';
process.env.MAILGUN_DOMAIN = '';
process.env.COOKIE_SECURE = 'false';
const { createApp } = await import('../src/app.js');
const db = createDb({ memory: true });
await db.ready();
const app = express();
app.get('/api/mh06-e2e', (_req, res) => res.json({ isolated: true }));
app.use(createApp({ db }));
const server = app.listen(8080, '127.0.0.1', () => console.log('MH-06 E2E: isolated in-memory PostgreSQL on port 8080'));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => db.close().then(() => process.exit(0))));
}
