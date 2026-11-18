import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPgliteDb } from '../src/db/postgres.js';

/**
 * Runs once before all test files: creates the schema and seed data in an
 * embedded PostgreSQL (PGlite) and saves its data directory to a temp file.
 * test/helpers/testDb.js starts each file's database from that file, which is
 * several times faster than creating the schema again.
 */
export default async function setup({ provide }) {
  const db = createPgliteDb(undefined);
  const dump = await db.dumpDataDir();
  await db.close();

  const file = path.join(os.tmpdir(), `mountain-hut-pglite-${process.pid}.tar`);
  fs.writeFileSync(file, Buffer.from(await dump.arrayBuffer()));
  provide('pgliteTemplate', file);

  return () => fs.rmSync(file, { force: true });
}
