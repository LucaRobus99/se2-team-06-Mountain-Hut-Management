// Isolated browser-test (Cypress) server. Never uses a local database or real
// Mailgun: every start gets a fresh in-memory PostgreSQL with the seed data.
// Started by `npm run e2e` in frontend/; runs on its own port (default 8090)
// so the regular backend on 8080 can keep running.
import express from 'express';
import { createDb } from '../src/db/index.js';

process.env.NODE_ENV = 'test';
process.env.MAILGUN_API_KEY = '';
process.env.API_KEY = '';
process.env.MAILGUN_DOMAIN = '';
process.env.COOKIE_SECURE = 'false';
const port = Number(process.env.E2E_PORT ?? 8090);
const { createApp } = await import('../src/app.js');
const db = createDb({ memory: true });
await db.ready();
const app = express();
// Specs call this first and stop unless it answers, so they never run against a real database.
app.get('/api/e2e', (_req, res) => res.json({ isolated: true }));
app.use(createApp({ db }));
const server = app.listen(port, '127.0.0.1', () => console.log(`E2E: isolated in-memory PostgreSQL on port ${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => db.close().then(() => process.exit(0))));
}
