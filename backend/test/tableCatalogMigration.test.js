import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { createPgliteDb } from '../src/db/postgres.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Each test opens an on-disk PGlite three times (~15 s alone); leave headroom
// for the full suite, where many test files start PGlite in parallel.
const MIGRATION_TIMEOUT_MS = 60_000;

async function legacyDatabase(inconsistent, verify) {
  const directory = await mkdtemp(path.join(tmpdir(), 'hut-table-catalog-'));
  let legacy, migrated;
  try {
    legacy = new PGlite(directory);
    await legacy.waitReady;
    await legacy.exec(`
      CREATE TABLE users(id INTEGER PRIMARY KEY);
      CREATE TABLE meals(id INTEGER PRIMARY KEY, meal_type TEXT NOT NULL);
      CREATE TABLE menus(
        id INTEGER PRIMARY KEY,
        meal_id INTEGER REFERENCES meals(id),
        name TEXT NOT NULL,
        content TEXT NOT NULL
      );
      CREATE TABLE slots(
        id INTEGER PRIMARY KEY,
        meal_id INTEGER,
        menu_id INTEGER REFERENCES menus(id),
        date TEXT NOT NULL DEFAULT '2026-08-14',
        start_time TEXT NOT NULL DEFAULT '12:00',
        end_time TEXT NOT NULL DEFAULT '13:00',
        status TEXT NOT NULL DEFAULT 'available',
        archived_at TEXT
      );
      CREATE TABLE dining_tables(id INTEGER PRIMARY KEY, label TEXT NOT NULL);
      CREATE TABLE slot_tables(
        slot_id INTEGER REFERENCES slots(id),
        table_id INTEGER REFERENCES dining_tables(id),
        seats INTEGER NOT NULL
      );
      CREATE TABLE bookings(id INTEGER PRIMARY KEY);
      INSERT INTO meals VALUES(2, 'lunch');
      INSERT INTO slots(id, meal_id, date, start_time, end_time) VALUES
        (1, 2, '2026-08-14', '12:00', '13:00'),
        (2, 2, '2026-08-15', '12:00', '13:00'),
        (3, 2, '2026-08-16', '12:00', '13:00');
      INSERT INTO dining_tables VALUES(1,'T1');
      INSERT INTO slot_tables VALUES(1,1,4),(2,1,${inconsistent ? 6 : 4});
      INSERT INTO bookings VALUES(11);
    `);
    await legacy.close();
    legacy = null;

    migrated = createPgliteDb(directory);
    await verify(migrated);
    await migrated.close();
    migrated = null;

    legacy = new PGlite(directory);
    await legacy.waitReady;
    expect((await legacy.query('SELECT id FROM bookings')).rows).toEqual([{ id: 11 }]);
    expect((await legacy.query('SELECT seats FROM slot_tables ORDER BY slot_id')).rows)
      .toEqual([{ seats: 4 }, { seats: inconsistent ? 6 : 4 }]);
    expect((await legacy.query("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dining_tables' AND column_name='seats') AS present")).rows[0].present).toBe(!inconsistent);
  } finally {
    await migrated?.close();
    await legacy?.close();
    await rm(directory, { recursive: true, force: true });
  }
}

describe('MH-02 #47 migration', () => {
  it('preserves consistent legacy assignments and enforces the fixed capacity', async () => {
    await legacyDatabase(false, async db => {
      await db.ready();
      expect((await db.query('SELECT seats FROM dining_tables')).rows).toEqual([{ seats: 4 }]);
      await expect(db.query('INSERT INTO slot_tables VALUES(3,1,6)')).rejects.toThrow();
    });
  }, MIGRATION_TIMEOUT_MS);

  it('refuses ambiguous legacy capacities without altering historical assignments', async () => {
    await legacyDatabase(true, async db => {
      await expect(db.ready()).rejects.toThrow(/Legacy table capacities are inconsistent/);
    });
  }, MIGRATION_TIMEOUT_MS);
});