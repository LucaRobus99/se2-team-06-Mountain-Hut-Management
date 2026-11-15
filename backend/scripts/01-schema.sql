-- Database schema (SQLite).
-- Run automatically by the backend when the SQLite file has no tables yet.
-- After changing this file, run `npm run db:reset`.
--
-- Dates are stored as TEXT 'YYYY-MM-DD', times as TEXT 'HH:MM' (hut local time),
-- timestamps as TEXT ISO-8601 in UTC.

-- The system serves a single mountain hut (context.md), so no table holds huts
-- and no row carries a hut id.

-- Hikers register themselves (registration/login task).
-- Employees and wardens are created beforehand in 02-seed.sql.
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    role            TEXT NOT NULL CHECK (role IN ('hiker', 'employee', 'warden')),
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    phone           VARCHAR(30),
    notes           TEXT,
    emergency_contact VARCHAR(200),
    avatar_blob     BLOB,
    avatar_mime     TEXT,
    avatar_version  INTEGER NOT NULL DEFAULT 0,
    -- MH-07: staff-created hiker accounts must choose a new password at login.
    password_change_required INTEGER NOT NULL DEFAULT 0 CHECK (password_change_required IN (0, 1)),
    password_hash   TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_ci ON users (lower(email));

-- MH-02: the hut's table labels (T1, T2, ...). Seats are not stored here: each
-- slot sets the seats of its tables in slot_tables (issue #17: no fixed table set).
CREATE TABLE IF NOT EXISTS dining_tables (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       VARCHAR(50) NOT NULL UNIQUE
);

-- Meal types are categories, NOT fixed time ranges. MH-02: staff selects a meal
-- for any start/end interval, including unusual serving times.
CREATE TABLE IF NOT EXISTS meals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_type       TEXT NOT NULL UNIQUE CHECK (meal_type IN ('breakfast', 'lunch', 'aperitivo', 'dinner'))
);

-- A meal offers one or more menus (the "at least one" rule is checked by the service).
CREATE TABLE IF NOT EXISTS menus (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id     INTEGER NOT NULL REFERENCES meals (id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    UNIQUE (meal_id, name)
);

-- MH-02: a slot is saved as 'available' and can be switched 'off' at any time.
-- A slot is [start_time, end_time) on one day, so it ends after it starts and
-- never crosses midnight. Slots of the same day may not overlap, also
-- when switched off (trigger below); back-to-back slots (12-13, 13-14) are fine.
-- Each slot has exactly one meal chosen explicitly by the employee.
-- A meal type does not constrain start/end time.
CREATE TABLE IF NOT EXISTS slots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id     INTEGER NOT NULL REFERENCES meals (id),
    date        TEXT NOT NULL,
    start_time  TEXT NOT NULL,
    end_time    TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'off')),
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK (start_time < end_time)
);

-- MH-02: the table set of a slot, i.e. which tables it uses and how many seats
-- each has in that slot. Each slot owns its seats, so copying a set to another
-- slot or changing one slot never changes the seats of other slots (issue #17).
CREATE TABLE IF NOT EXISTS slot_tables (
    slot_id     INTEGER NOT NULL REFERENCES slots (id) ON DELETE CASCADE,
    table_id    INTEGER NOT NULL REFERENCES dining_tables (id),
    seats       INTEGER NOT NULL CHECK (seats > 0),
    PRIMARY KEY (slot_id, table_id)
);

-- MH-01: confirmed immediately (no approval).
-- MH-07: a booking always has an owner. Either:
-- - the hiker books for themself: hiker_id is set, created_by stays NULL and the
--   contact details are copied from the hiker's profile;
-- - staff books on someone's behalf (hiker, new account or temporary guest):
--   created_by is set. For a registered hiker or a staff-created account
--   hiker_id is set too, so the booking appears in that hiker's own history;
--   a temporary guest has no account (hiker_id NULL) and only the contact
--   details stored on the booking (`contactNumber` in the API). Guests cannot
--   authenticate because no user row exists for them.
CREATE TABLE IF NOT EXISTS bookings (
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
);

-- MH-01: seats assigned to a booking at each table. A party can be split across
-- several tables, and a table can be shared by several parties (issue #11).
CREATE TABLE IF NOT EXISTS booking_seats (
    booking_id  INTEGER NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
    table_id    INTEGER NOT NULL REFERENCES dining_tables (id),
    seats       INTEGER NOT NULL CHECK (seats > 0),
    PRIMARY KEY (booking_id, table_id)
);

CREATE TABLE IF NOT EXISTS booking_requirements (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id      INTEGER NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
    description     TEXT NOT NULL,
    allergies       INTEGER NOT NULL DEFAULT 0 CHECK (allergies IN (0, 1)),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_booking_requirements_booking ON booking_requirements (booking_id);

-- MH-07 / #44: single-use password reset tokens. Only the SHA-256 hash of the
-- token is stored, never the token itself; links expire after 24 hours.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TEXT NOT NULL,
    used_at     TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_slots_date ON slots (date);
CREATE INDEX IF NOT EXISTS idx_slots_meal ON slots (meal_id);
CREATE INDEX IF NOT EXISTS idx_menus_meal ON menus (meal_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings (slot_id);
CREATE INDEX IF NOT EXISTS idx_booking_seats_table ON booking_seats (table_id);

-- Issue #25: a hiker can have only one confirmed booking per slot.
-- Cancelled bookings do not block a new one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_one_confirmed_per_hiker_slot
ON bookings (hiker_id, slot_id)
WHERE status = 'confirmed' AND hiker_id IS NOT NULL;

-- Slots of the same day may not overlap. The service checks this first to
-- suggest a free time; these triggers guard every other write (seed, MH-19).
CREATE TRIGGER IF NOT EXISTS slots_no_overlap_insert
BEFORE INSERT ON slots
WHEN EXISTS (
    SELECT 1 FROM slots
    WHERE date = NEW.date AND start_time < NEW.end_time AND NEW.start_time < end_time
)
BEGIN
    SELECT RAISE(ABORT, 'Slot overlaps another slot');
END;

CREATE TRIGGER IF NOT EXISTS slots_no_overlap_update
BEFORE UPDATE OF date, start_time, end_time ON slots
WHEN EXISTS (
    SELECT 1 FROM slots
    WHERE id <> NEW.id AND date = NEW.date
      AND start_time < NEW.end_time AND NEW.start_time < end_time
)
BEGIN
    SELECT RAISE(ABORT, 'Slot overlaps another slot');
END;
