import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts');

/**
 * Database connection using Node's built-in SQLite (`node:sqlite`, no extra install).
 * DAOs call `query(sql, params)` → { rows, rowCount }. Placeholders are written `$1, $2…`
 * in the DAOs and bound as SQLite named parameters. Repeating `$1` in a
 * query reuses the same value (e.g. in range checks).
 *
 * `transaction(fn)` runs `fn` inside BEGIN IMMEDIATE … COMMIT (ROLLBACK on error).
 * Only one transaction runs at a time, so "check free seats, then insert the booking"
 * cannot be interleaved with another booking: the first one saved wins (AC-01.9).
 * All writes that depend on a check (bookings, slot changes) must use it.
 *
 * On first start (no tables yet) it runs scripts/*.sql to create the schema and seed data.
 */
export function createSqliteDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });

  const database = new DatabaseSync(file);
  database.exec('PRAGMA foreign_keys = ON');
  initialiseIfEmpty(database);
  assertCurrentSchema(database);
  migrateHikerProfile(database);
  migrateMealAssignments(database);

  let queue = Promise.resolve();

  const db = {
    async query(sql, params = []) {
      // Node's DatabaseSync positional binding does not accept numbered placeholders
      // such as `$1` or `?1` in Node 22. Bind `$1`, `$2` as named parameters.
      // This also preserves repeated references to the same placeholder.
      const statement = database.prepare(sql);
      const bindings = Object.fromEntries(params.map((value, i) => [`$${i + 1}`, value]));
      if (/^\s*(select|with)\b/i.test(sql) || /\breturning\b/i.test(sql)) {
        const rows = (params.length ? statement.all(bindings) : statement.all()).map((row) => ({ ...row }));
        return { rows, rowCount: rows.length };
      }
      const { changes } = params.length ? statement.run(bindings) : statement.run();
      return { rows: [], rowCount: Number(changes) };
    },

    transaction(fn) {
      const run = queue.then(async () => {
        database.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn(db);
          database.exec('COMMIT');
          return result;
        } catch (err) {
          database.exec('ROLLBACK');
          throw err;
        }
      });
      queue = run.catch(() => {});
      return run;
    },

    async close() {
      await queue;
      database.close();
    },
  };

  return db;
}

function initialiseIfEmpty(database) {
  const { count } = database
    .prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .get();
  if (count > 0) return;

  const scripts = fs.readdirSync(SCRIPTS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const script of scripts) {
    database.exec(fs.readFileSync(path.join(SCRIPTS_DIR, script), 'utf8'));
  }
  console.log(`SQLite: created schema and seed data (${scripts.join(', ')})`);
}

/** Add optional hiker profile fields to databases created before registration.
 * Existing staff and bookings are preserved; resetting the database is unnecessary.
 */
function migrateHikerProfile(database) {
  const columns = new Set(database.prepare('PRAGMA table_info(users)').all().map((col) => col.name));
  if (!columns.has('notes')) database.exec('ALTER TABLE users ADD COLUMN notes TEXT');
  if (!columns.has('emergency_contact')) database.exec('ALTER TABLE users ADD COLUMN emergency_contact VARCHAR(200)');
  database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_ci ON users (lower(email))');
}

/** Older local databases contain hut_id and lack per-slot seat capacities.
 * They cannot safely be used with current DAO queries; never delete user data.
 */
function assertCurrentSchema(database) {
  const cols = (table) => new Set(database.prepare(`PRAGMA table_info(${table})`).all().map((col) => col.name));
  if (!cols('slot_tables').has('seats') || cols('slots').has('hut_id')) {
    database.close();
    throw new Error(
      'Legacy SQLite schema detected. Back up database/database.sqlite, then run npm run db:reset ' +
      'to generate the current schema. Existing data is not deleted automatically.'
    );
  }
}

/** Upgrade databases from the old time-range-based meal model without deleting
 * existing bookings, users or slots. Old meal start/end columns can remain as
 * unused legacy data; only new databases use the simplified meals table.
 * The old triggers otherwise override explicit meal_id and reject valid slots.
 */
function migrateMealAssignments(database) {
  const legacyTriggers = [
    'meals_no_overlap_insert', 'meals_no_overlap_update',
    'slots_require_meal_insert', 'slots_require_meal_update',
    'slots_resolve_meal_insert', 'slots_resolve_meal_update',
  ];
  for (const name of legacyTriggers) {
    database.exec(`DROP TRIGGER IF EXISTS ${name}`);
  }
}
