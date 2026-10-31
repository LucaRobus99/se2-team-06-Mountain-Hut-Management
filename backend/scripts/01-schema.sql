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
    password_hash   TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- MH-02: the hut's table labels (T1, T2, ...). Seats are not stored here: each
-- slot sets the seats of its tables in slot_tables (issue #17: no fixed table set).
CREATE TABLE IF NOT EXISTS dining_tables (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       VARCHAR(50) NOT NULL UNIQUE
);

-- A meal is a meal type served by the hut in a time range [start_time, end_time),
-- e.g. breakfast 09:00-12:00, so a slot starting at 12:00 belongs to lunch.
-- A slot may start at any minute of the range (MH-02: flexible start times).
-- Ranges may not overlap (trigger below); gaps are allowed.
CREATE TABLE IF NOT EXISTS meals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_type       TEXT NOT NULL UNIQUE CHECK (meal_type IN ('breakfast', 'lunch', 'aperitivo', 'dinner')),
    start_time      TEXT NOT NULL,
    end_time        TEXT NOT NULL,
    CHECK (start_time < end_time)
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
-- The whole slot must fall inside one meal range (meal start <= slot start and
-- slot end <= meal end), so each slot has exactly one meal; meal_id is resolved
-- by the triggers below.
CREATE TABLE IF NOT EXISTS slots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id     INTEGER REFERENCES meals (id),
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

-- MH-01: confirmed immediately (no approval). Exactly one owner:
-- - a hiker's own booking sets hiker_id; its contact details are copied from the
--   hiker's profile;
-- - a booking made by staff for a guest sets created_by (MH-07); the guest's
--   contact details come from the request, at least one of name, email or phone
--   (`contactNumber` in the API).
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
    CHECK ((hiker_id IS NULL) <> (created_by IS NULL)),
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

-- Meal time ranges must not overlap, so each slot maps to one meal.
CREATE TRIGGER IF NOT EXISTS meals_no_overlap_insert
BEFORE INSERT ON meals
WHEN EXISTS (
    SELECT 1 FROM meals
    WHERE start_time < NEW.end_time AND NEW.start_time < end_time
)
BEGIN
    SELECT RAISE(ABORT, 'Meal time range overlaps another meal');
END;

CREATE TRIGGER IF NOT EXISTS meals_no_overlap_update
BEFORE UPDATE OF start_time, end_time ON meals
WHEN EXISTS (
    SELECT 1 FROM meals
    WHERE id <> NEW.id AND start_time < NEW.end_time AND NEW.start_time < end_time
)
BEGIN
    SELECT RAISE(ABORT, 'Meal time range overlaps another meal');
END;

-- Slot creation: reject a slot that does not fit inside one meal range, then link the meal.
CREATE TRIGGER IF NOT EXISTS slots_require_meal_insert
BEFORE INSERT ON slots
WHEN NOT EXISTS (
    SELECT 1 FROM meals
    WHERE start_time <= NEW.start_time AND NEW.end_time <= end_time
)
BEGIN
    SELECT RAISE(ABORT, 'Slot does not fit inside a meal time range');
END;

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

CREATE TRIGGER IF NOT EXISTS slots_resolve_meal_insert
AFTER INSERT ON slots
BEGIN
    UPDATE slots SET meal_id = (
        SELECT id FROM meals
        WHERE start_time <= NEW.start_time AND NEW.start_time < end_time
    )
    WHERE id = NEW.id;
END;

-- Same rules when a slot is moved to another time.
CREATE TRIGGER IF NOT EXISTS slots_require_meal_update
BEFORE UPDATE OF start_time, end_time ON slots
WHEN NOT EXISTS (
    SELECT 1 FROM meals
    WHERE start_time <= NEW.start_time AND NEW.end_time <= end_time
)
BEGIN
    SELECT RAISE(ABORT, 'Slot does not fit inside a meal time range');
END;

CREATE TRIGGER IF NOT EXISTS slots_resolve_meal_update
AFTER UPDATE OF start_time ON slots
BEGIN
    UPDATE slots SET meal_id = (
        SELECT id FROM meals
        WHERE start_time <= NEW.start_time AND NEW.start_time < end_time
    )
    WHERE id = NEW.id;
END;
