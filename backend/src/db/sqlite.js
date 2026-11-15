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
  migrateBookingRequirements(database);
  migrateBookingOwnership(database);
  migrateAccountAvatar(database);
  migratePasswordChangeRequired(database);
  migratePasswordResetTokens(database);

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

/** Add booking_requirements table to databases created before MH-05. */
function migrateBookingRequirements(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS booking_requirements (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id      INTEGER NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
    description     TEXT NOT NULL,
    allergies       INTEGER NOT NULL DEFAULT 0 CHECK (allergies IN (0, 1)),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);
  database.exec('CREATE INDEX IF NOT EXISTS idx_booking_requirements_booking ON booking_requirements (booking_id)');
}

/** Add avatar columns without resetting or touching existing reservations and slots. */
function migrateAccountAvatar(database) {
  const columns = new Set(database.prepare('PRAGMA table_info(users)').all().map((col) => col.name));
  if (!columns.has('avatar_blob')) database.exec('ALTER TABLE users ADD COLUMN avatar_blob BLOB');
  if (!columns.has('avatar_mime')) database.exec('ALTER TABLE users ADD COLUMN avatar_mime TEXT');
  if (!columns.has('avatar_version')) database.exec('ALTER TABLE users ADD COLUMN avatar_version INTEGER NOT NULL DEFAULT 0');
}

/**
 * MH-07: allow a booking to record both the owner (hiker_id) and the staff
 * member who created it (created_by). Registered hikers and staff-created
 * accounts keep their own booking history; temporary guests have no account.
 *
 * SQLite cannot alter a CHECK constraint, so the table is rebuilt once.
 * Foreign keys are disabled for the rebuild (otherwise dropping `bookings`
 * would cascade-delete `booking_seats` and `booking_requirements`), and every
 * row plus the two booking indexes is recreated inside one transaction.
 */
function migrateBookingOwnership(database) {
  const table = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bookings'")
    .get();

  // Already migrated (or schema not created yet): nothing to do.
  if (!table?.sql || !table.sql.includes('<>')) return;

  database.exec('PRAGMA foreign_keys = OFF');
  try {
    database.exec('BEGIN IMMEDIATE');
    try {
      database.exec(`CREATE TABLE bookings_mh07 (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        slot_id         INTEGER NOT NULL REFERENCES slots (id),
        hiker_id        INTEGER REFERENCES users (id),
        created_by      INTEGER REFERENCES users (id),
        contact_name    VARCHAR(100),
        email           VARCHAR(255),
        phone           VARCHAR(30),
        party_size      INTEGER NOT NULL CHECK (party_size > 0),
        status          TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
        created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (hiker_id IS NOT NULL OR created_by IS NOT NULL),
        CHECK (contact_name IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL)
      )`);

      database.exec(`INSERT INTO bookings_mh07
        (id, slot_id, hiker_id, created_by, contact_name, email, phone, party_size, status, created_at)
        SELECT id, slot_id, hiker_id, created_by, contact_name, email, phone, party_size, status, created_at
        FROM bookings`);

      database.exec('DROP TABLE bookings');
      database.exec('ALTER TABLE bookings_mh07 RENAME TO bookings');

      database.exec('CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings (slot_id)');
      database.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_one_confirmed_per_hiker_slot
        ON bookings (hiker_id, slot_id)
        WHERE status = 'confirmed' AND hiker_id IS NOT NULL`);

      database.exec('COMMIT');
    } catch (err) {
      database.exec('ROLLBACK');
      throw err;
    }
  } finally {
    database.exec('PRAGMA foreign_keys = ON');
  }

  console.log('SQLite: rebuilt bookings to allow staff-created bookings for hikers (MH-07).');
}

/** MH-07: staff-created hiker accounts must change their password at first login. */
function migratePasswordChangeRequired(database) {
  const columns = new Set(database.prepare('PRAGMA table_info(users)').all().map((col) => col.name));
  if (!columns.has('password_change_required')) {
    database.exec(
      'ALTER TABLE users ADD COLUMN password_change_required INTEGER NOT NULL DEFAULT 0 ' +
      'CHECK (password_change_required IN (0, 1))'
    );
  }
}

/** MH-07 / #44: single-use, hashed password reset tokens with a 24-hour expiry. */
function migratePasswordResetTokens(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TEXT NOT NULL,
    used_at     TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);
  database.exec('CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens (user_id)');
}
