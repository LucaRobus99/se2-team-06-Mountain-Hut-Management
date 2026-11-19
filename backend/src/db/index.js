import { createPgDb, createPgliteDb } from './postgres.js';

/**
 * Picks the database:
 * - `DATABASE_URL` set (Docker, production) → PostgreSQL server;
 * - otherwise → embedded PostgreSQL (PGlite) stored in `PGLITE_DIR`,
 *   so `npm run dev` works without Docker.
 * `{ memory: true }` → in-memory PGlite (lost on close).
 * Tests use test/helpers/testDb.js instead, which reuses one seeded instance.
 */
export function createDb({ databaseUrl, pgliteDir, memory = false } = {}) {
  if (memory) return createPgliteDb(undefined);
  if (databaseUrl) return createPgDb(databaseUrl);
  return createPgliteDb(pgliteDir);
}

/** Human-readable target for the startup log (never prints the password). */
export function describeDb({ databaseUrl, pgliteDir }) {
  if (!databaseUrl) return `PGlite (${pgliteDir})`;
  try {
    const url = new URL(databaseUrl);
    return `PostgreSQL ${url.hostname}:${url.port || 5432}${url.pathname}`;
  } catch {
    return 'PostgreSQL';
  }
}
