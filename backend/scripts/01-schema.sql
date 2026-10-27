-- Database schema (SQLite).
-- Run automatically by the backend when the SQLite file has no tables yet.
-- After changing this file, run `npm run db:reset`.
--
-- Dates are stored as TEXT 'YYYY-MM-DD', times as TEXT 'HH:MM' (hut local time),
-- timestamps as TEXT ISO-8601 in UTC.

-- The data model supports several huts; the MVP shows only one.
CREATE TABLE IF NOT EXISTS huts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        VARCHAR(100) NOT NULL
);

-- Hikers register themselves (registration/login task).
-- Employees and wardens are created beforehand in 02-seed.sql and belong to a hut.
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    role            TEXT NOT NULL CHECK (role IN ('hiker', 'employee', 'warden')),
    hut_id          INTEGER REFERENCES huts (id),
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    phone           VARCHAR(30),
    password_hash   TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK ((role = 'hiker' AND hut_id IS NULL) OR (role <> 'hiker' AND hut_id IS NOT NULL))
);

-- MH-02: each table has its own number of seats (issue #11).
CREATE TABLE IF NOT EXISTS dining_tables (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    hut_id      INTEGER NOT NULL REFERENCES huts (id),
    label       VARCHAR(50) NOT NULL,
    seats       INTEGER NOT NULL CHECK (seats > 0),
    UNIQUE (hut_id, label)
);

-- MH-02: a slot is saved as 'available' and can be switched 'off' at any time.
-- end_time may become required depending on clarification issue 6.
CREATE TABLE IF NOT EXISTS slots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    hut_id      INTEGER NOT NULL REFERENCES huts (id),
    date        TEXT NOT NULL,
    start_time  TEXT NOT NULL,
    end_time    TEXT,
    status      TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'off')),
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (hut_id, date, start_time)
);

-- MH-02: which tables a slot uses. May change depending on clarification issue 7
-- (tables defined once for the hut vs. per slot).
CREATE TABLE IF NOT EXISTS slot_tables (
    slot_id     INTEGER NOT NULL REFERENCES slots (id) ON DELETE CASCADE,
    table_id    INTEGER NOT NULL REFERENCES dining_tables (id),
    PRIMARY KEY (slot_id, table_id)
);

-- MH-01: confirmed immediately (no approval). An email is always required,
-- also when an employee books for a hiker (MH-07), so hiker_id may be NULL.
CREATE TABLE IF NOT EXISTS bookings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id         INTEGER NOT NULL REFERENCES slots (id),
    hiker_id        INTEGER REFERENCES users (id),
    created_by      INTEGER NOT NULL REFERENCES users (id),
    contact_name    VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    phone           VARCHAR(30),
    party_size      INTEGER NOT NULL CHECK (party_size > 0),
    status          TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- MH-01: seats assigned to a booking at each table. A party can be split across
-- several tables, and a table can be shared by several parties (issue #11).
CREATE TABLE IF NOT EXISTS booking_seats (
    booking_id  INTEGER NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
    table_id    INTEGER NOT NULL REFERENCES dining_tables (id),
    seats       INTEGER NOT NULL CHECK (seats > 0),
    PRIMARY KEY (booking_id, table_id)
);

CREATE INDEX IF NOT EXISTS idx_slots_hut_date ON slots (hut_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings (slot_id);
CREATE INDEX IF NOT EXISTS idx_booking_seats_table ON booking_seats (table_id);
