import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const SCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts');

/** COUNT() and SUM() return bigint, which drivers hand back as strings by default. */
const INT8_OID = 20;
const parseInt8 = (value) => (value === null ? null : Number.parseInt(value, 10));

/**
 * Key of the advisory lock every transaction takes first. One key for the whole
 * app keeps the old guarantee: only one transaction runs at a time, so "check free
 * seats, then insert the booking" cannot be interleaved with another booking and
 * the first one saved wins (AC-01.9).
 */
const TRANSACTION_LOCK_KEY = 6_000_601;

/**
 * Database connection for PostgreSQL. Every database object has the same
 * interface, so DAOs and services do not know which one they use:
 *
 *   query(sql, params)  → { rows, rowCount }   (placeholders `$1, $2…`)
 *   transaction(fn)     → runs fn(tx) inside BEGIN … COMMIT (ROLLBACK on error)
 *   ready()             → resolves once the schema exists (call before listening)
 *   close()
 *
 * On first use, if the database has no `users` table, scripts/*.sql create the
 * schema and seed data. The #47 compatible-capacity migration also runs on
 * older databases; any inconsistent legacy capacities are rejected.
 */

/** Server PostgreSQL (Docker / production), via a `pg` connection pool. */
export function createPgDb(connectionString) {
  pg.types.setTypeParser(INT8_OID, parseInt8);
  const pool = new pg.Pool({ connectionString });

  const wrap = (client) => ({
    async query(sql, params = []) {
      return toResult(await client.query(sql, params));
    },
  });

  let initialised;
  const ready = () => (initialised ??= connectWithRetry(pool).then(() => withClient(pool, async (client) => {
    await client.query('SELECT pg_advisory_lock($1)', [TRANSACTION_LOCK_KEY]);
    try {
      await initialiseIfEmpty((sql) => client.query(sql));
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [TRANSACTION_LOCK_KEY]);
    }
  })));

  return {
    ready,

    async query(sql, params = []) {
      await ready();
      return toResult(await pool.query(sql, params));
    },

    /** Runs a script of several statements without parameters. */
    async exec(sql) {
      await ready();
      await pool.query(sql);
    },

    async transaction(fn) {
      await ready();
      return withClient(pool, async (client) => {
        await client.query('BEGIN');
        try {
          await client.query('SELECT pg_advisory_xact_lock($1)', [TRANSACTION_LOCK_KEY]);
          const result = await fn(wrap(client));
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        }
      });
    },

    async close() {
      await pool.end();
    },
  };
}

/**
 * Embedded PostgreSQL (PGlite, WebAssembly) for tests and for running the backend
 * without Docker. `dataDir` undefined = in-memory database, lost on close.
 * PGlite has a single connection, so transactions are queued one at a time.
 * `templateFile` (tests only): start from a dumped data directory instead of an
 * empty cluster, which is much faster than creating the schema again.
 */
export function createPgliteDb(dataDir, { templateFile } = {}) {
  if (dataDir) fs.mkdirSync(path.resolve(dataDir), { recursive: true });

  let database;
  let initialised;
  const ready = () => (initialised ??= (async () => {
    // Imported lazily: PGlite is a dev dependency and is absent from the Docker image.
    const { PGlite } = await import('@electric-sql/pglite');
    const loadDataDir = templateFile ? new Blob([fs.readFileSync(templateFile)]) : undefined;
    database = new PGlite(dataDir, { parsers: { [INT8_OID]: parseInt8 }, loadDataDir });
    await database.waitReady;
    await initialiseIfEmpty((sql) => database.exec(sql));
  })());

  let queue = Promise.resolve();

  const db = {
    ready,

    async query(sql, params = []) {
      await ready();
      return toResult(await database.query(sql, params));
    },

    /** Runs a script of several statements without parameters. */
    async exec(sql) {
      await ready();
      await database.exec(sql);
    },

    /** Tests only: the data directory as a tarball (see test/globalSetup.js). */
    async dumpDataDir() {
      await ready();
      return database.dumpDataDir('none');
    },

    transaction(fn) {
      const run = queue.then(async () => {
        await ready();
        await database.exec('BEGIN');
        try {
          const result = await fn(db);
          await database.exec('COMMIT');
          return result;
        } catch (err) {
          await database.exec('ROLLBACK');
          throw err;
        }
      });
      queue = run.catch(() => {});
      return run;
    },

    async close() {
      await queue;
      if (database) await database.close();
    },
  };

  return db;
}

/** `{ rows, rowCount }` for both drivers: rows returned, or rows changed by a write. */
function toResult(res) {
  const rows = res.rows ?? [];
  const changed = res.rowCount ?? res.affectedRows ?? 0;
  return { rows, rowCount: rows.length > 0 ? rows.length : changed };
}

async function initialiseIfEmpty(exec) {
  const result = await exec("SELECT to_regclass('public.users') IS NOT NULL AS present");
  const present = (Array.isArray(result) ? result[0] : result).rows[0].present;
  if (present) {
    // #47: preserve existing reservations and assignments. A legacy label
    // with conflicting capacities needs a deliberate physical-table decision;
    // do not silently increase/reduce past capacity or discard bookings.
    const column = await exec("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dining_tables' AND column_name = 'seats') AS present");
    if (!(Array.isArray(column) ? column[0] : column).rows[0].present) {
      try { await exec(`BEGIN;
        DO $$ BEGIN
          IF EXISTS (
            SELECT dt.id FROM dining_tables dt LEFT JOIN slot_tables st ON st.table_id = dt.id
            GROUP BY dt.id HAVING COUNT(DISTINCT st.seats) <> 1
          ) THEN
            RAISE EXCEPTION 'Legacy table capacities are inconsistent or unknown. Resolve them explicitly or use a fresh test database; existing data was not changed.';
          END IF;
        END $$;
        ALTER TABLE dining_tables ADD COLUMN seats INTEGER;
        UPDATE dining_tables dt SET seats = (SELECT MIN(st.seats) FROM slot_tables st WHERE st.table_id = dt.id);
        ALTER TABLE dining_tables ALTER COLUMN seats SET NOT NULL;
        ALTER TABLE dining_tables ADD CHECK (seats > 0);
        ALTER TABLE dining_tables ADD UNIQUE (id, seats);
        ALTER TABLE slot_tables ADD FOREIGN KEY (table_id, seats) REFERENCES dining_tables(id, seats);
        COMMIT;`); }
      catch (error) { await exec('ROLLBACK;').catch(() => {}); throw error; }
    }

    // MH-10-02: menus now store rich-text `content` (NOT NULL) and an
    // `updated_at` stamp; slots can reference an assigned menu.
    const menuMigrate = `BEGIN;
      DO $$
      BEGIN
        IF to_regclass('public.menus') IS NOT NULL THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'menus' AND column_name = 'content') THEN
            ALTER TABLE menus ADD COLUMN content TEXT;
            UPDATE menus SET content = coalesce(description, '') WHERE content IS NULL;
          END IF;
          ALTER TABLE menus ALTER COLUMN content SET NOT NULL;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'menus' AND column_name = 'updated_at') THEN
            ALTER TABLE menus ADD COLUMN updated_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z');
          END IF;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'slots' AND column_name = 'menu_id') THEN
          ALTER TABLE slots ADD COLUMN menu_id INTEGER REFERENCES menus(id) ON DELETE SET NULL;
        END IF;
        -- MH-10-02/03: unsaved menu variants live on the slot, not in menus.
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'slots' AND column_name = 'menu_name_override') THEN
          ALTER TABLE slots ADD COLUMN menu_name_override TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'slots' AND column_name = 'menu_content_override') THEN
          ALTER TABLE slots ADD COLUMN menu_content_override TEXT;
        END IF;
      END $$;
      COMMIT;`;
    try { await exec(menuMigrate); }
    catch (error) { await exec('ROLLBACK;').catch(() => {}); throw error; }
    return;
  }

  const scripts = fs.readdirSync(SCRIPTS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const sql = scripts.map((f) => fs.readFileSync(path.join(SCRIPTS_DIR, f), 'utf8')).join('\n');
  await exec(`BEGIN;\n${sql}\nCOMMIT;`);
  if (process.env.NODE_ENV !== 'test') {
    console.log(`PostgreSQL: created schema and seed data (${scripts.join(', ')})`);
  }
}

async function withClient(pool, fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** The db container may still be starting; retry for about 30 seconds. */
async function connectWithRetry(pool, attempts = 30) {
  for (let i = 1; ; i += 1) {
    try {
      await withClient(pool, (client) => client.query('SELECT 1'));
      return;
    } catch (err) {
      if (i >= attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
