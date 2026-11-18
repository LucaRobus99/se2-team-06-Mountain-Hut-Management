import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, inject } from 'vitest';
import { createPgliteDb } from '../../src/db/postgres.js';

/**
 * Test database: embedded PostgreSQL (PGlite).
 *
 * Starting PGlite takes seconds, so each test file starts ONE instance from the
 * seeded template built by test/globalSetup.js. Every `createTestDb()` call then
 * resets that instance to the seed data (TRUNCATE … RESTART IDENTITY + seed),
 * which takes milliseconds. Each test still sees a fresh database, exactly like
 * the old in-memory SQLite database did: same schema, same seed rows, same ids.
 *
 * The shared instance starts in a `beforeAll` hook (hook timeout, not test timeout)
 * and is closed after the last test of the file. `close()` on a test database
 * only marks that handle closed: later queries through it fail, like a real
 * closed connection (the health check test relies on this).
 */
const SCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts');

const TABLES = [
  'password_reset_tokens', 'booking_requirements', 'booking_seats', 'bookings',
  'slot_tables', 'slots', 'menus', 'meals', 'dining_tables', 'users',
];

const RESET_SQL = `TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE;\n`
  + fs.readFileSync(path.join(SCRIPTS_DIR, '02-seed.sql'), 'utf8');

let shared = null;

function sharedDb() {
  shared ??= createPgliteDb(undefined, { templateFile: inject('pgliteTemplate') });
  return shared;
}

// Start it before the first test, so a slow WebAssembly start-up never counts
// against a test's own timeout.
beforeAll(() => sharedDb().ready());

afterAll(async () => {
  if (shared) await shared.close();
  shared = null;
});

export function createTestDb() {
  const base = sharedDb();
  let reset;
  let closed = false;
  const ready = () => {
    if (closed) return Promise.reject(new Error('Database is closed'));
    return (reset ??= base.ready().then(() => base.exec(RESET_SQL)));
  };

  return {
    ready,
    async query(sql, params) {
      await ready();
      return base.query(sql, params);
    },
    async exec(sql) {
      await ready();
      return base.exec(sql);
    },
    async transaction(fn) {
      await ready();
      return base.transaction(fn);
    },
    async close() {
      if (closed) return;
      await ready();
      closed = true;
    },
  };
}
