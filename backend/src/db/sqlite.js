import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts');

/**
 * Database connection using Node's built-in SQLite (`node:sqlite`, no extra install).
 * DAOs call `query(sql, params)` → { rows, rowCount }. Placeholders are written `$1, $2…`
 * in the DAOs and converted here to SQLite's `?1, ?2…`.
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

  let queue = Promise.resolve();

  const db = {
    async query(sql, params = []) {
      const statement = database.prepare(sql.replace(/\$(\d+)/g, '?$1'));
      if (/^\s*(select|with)\b/i.test(sql) || /\breturning\b/i.test(sql)) {
        const rows = statement.all(...params).map((row) => ({ ...row }));
        return { rows, rowCount: rows.length };
      }
      const { changes } = statement.run(...params);
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
