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

-- A meal is a meal type served by the hut in a time range [start_time, end_time),
-- e.g. breakfast 09:00-12:00, so a slot starting at 12:00 belongs to lunch.
-- Slots start every step_minutes from start_time (breakfast: 09:00, 09:30, ...).
-- Ranges of the same hut may not overlap (trigger below); gaps are allowed.
CREATE TABLE IF NOT EXISTS meals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hut_id          INTEGER NOT NULL REFERENCES huts (id),
    meal_type       TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'aperitivo', 'dinner')),
    start_time      TEXT NOT NULL,
    end_time        TEXT NOT NULL,
    step_minutes    INTEGER NOT NULL CHECK (step_minutes > 0),
    CHECK (start_time < end_time),
    UNIQUE (hut_id, meal_type)
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
-- end_time may become required depending on clarification issue 6.
-- meal_id is resolved by the triggers below from the meal whose time range
-- contains start_time; a slot outside every meal range, or not on the meal's
-- step (e.g. 12:30 for an hourly lunch), is rejected.
CREATE TABLE IF NOT EXISTS slots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    hut_id      INTEGER NOT NULL REFERENCES huts (id),
    meal_id     INTEGER REFERENCES meals (id),
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

-- MH-01: confirmed immediately (no approval). Online bookings require an
-- authenticated hiker, so hiker_id is set; created_by is reserved for staff
-- bookings taken through other channels (MH-07) and is NULL for self-booking.
-- An email is always required and falls back to the hiker's profile email.
CREATE TABLE IF NOT EXISTS bookings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id         INTEGER NOT NULL REFERENCES slots (id),
    hiker_id        INTEGER REFERENCES users (id),
    created_by      INTEGER REFERENCES users (id),
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
CREATE INDEX IF NOT EXISTS idx_slots_meal ON slots (meal_id);
CREATE INDEX IF NOT EXISTS idx_menus_meal ON menus (meal_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings (slot_id);
CREATE INDEX IF NOT EXISTS idx_booking_seats_table ON booking_seats (table_id);

-- Issue #25: a hiker can have only one confirmed booking per slot.
-- Cancelled bookings do not block a new one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_one_confirmed_per_hiker_slot
ON bookings (hiker_id, slot_id)
WHERE status = 'confirmed' AND hiker_id IS NOT NULL;

-- Meal time ranges of the same hut must not overlap, so each slot maps to one meal.
CREATE TRIGGER IF NOT EXISTS meals_no_overlap_insert
BEFORE INSERT ON meals
WHEN EXISTS (
    SELECT 1 FROM meals
    WHERE hut_id = NEW.hut_id AND start_time < NEW.end_time AND NEW.start_time < end_time
)
BEGIN
    SELECT RAISE(ABORT, 'Meal time range overlaps another meal of the hut');
END;

CREATE TRIGGER IF NOT EXISTS meals_no_overlap_update
BEFORE UPDATE OF hut_id, start_time, end_time ON meals
WHEN EXISTS (
    SELECT 1 FROM meals
    WHERE id <> NEW.id AND hut_id = NEW.hut_id
      AND start_time < NEW.end_time AND NEW.start_time < end_time
)
BEGIN
    SELECT RAISE(ABORT, 'Meal time range overlaps another meal of the hut');
END;

-- Slot creation: reject a start time outside every meal range or off the meal's
-- step, then link the meal. Times 'HH:MM' are turned into minutes for the step check.
CREATE TRIGGER IF NOT EXISTS slots_require_meal_insert
BEFORE INSERT ON slots
WHEN NOT EXISTS (
    SELECT 1 FROM meals
    WHERE hut_id = NEW.hut_id AND start_time <= NEW.start_time AND NEW.start_time < end_time
      AND ((substr(NEW.start_time, 1, 2) * 60 + substr(NEW.start_time, 4, 2))
         - (substr(start_time, 1, 2) * 60 + substr(start_time, 4, 2))) % step_minutes = 0
)
BEGIN
    SELECT RAISE(ABORT, 'No meal is served at this slot start time');
END;

CREATE TRIGGER IF NOT EXISTS slots_resolve_meal_insert
AFTER INSERT ON slots
BEGIN
    UPDATE slots SET meal_id = (
        SELECT id FROM meals
        WHERE hut_id = NEW.hut_id AND start_time <= NEW.start_time AND NEW.start_time < end_time
    )
    WHERE id = NEW.id;
END;

-- Same rules when a slot is moved to another time or hut.
CREATE TRIGGER IF NOT EXISTS slots_require_meal_update
BEFORE UPDATE OF hut_id, start_time ON slots
WHEN NOT EXISTS (
    SELECT 1 FROM meals
    WHERE hut_id = NEW.hut_id AND start_time <= NEW.start_time AND NEW.start_time < end_time
      AND ((substr(NEW.start_time, 1, 2) * 60 + substr(NEW.start_time, 4, 2))
         - (substr(start_time, 1, 2) * 60 + substr(start_time, 4, 2))) % step_minutes = 0
)
BEGIN
    SELECT RAISE(ABORT, 'No meal is served at this slot start time');
END;

CREATE TRIGGER IF NOT EXISTS slots_resolve_meal_update
AFTER UPDATE OF hut_id, start_time ON slots
BEGIN
    UPDATE slots SET meal_id = (
        SELECT id FROM meals
        WHERE hut_id = NEW.hut_id AND start_time <= NEW.start_time AND NEW.start_time < end_time
    )
    WHERE id = NEW.id;
END;
