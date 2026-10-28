-- Sample data. Run automatically after 01-schema.sql when the database is created.
-- After changing this file, run `npm run db:reset`.

INSERT INTO huts (id, name) VALUES
    (1, 'Rifugio Demo');

-- Staff accounts are created here: only hikers can register themselves.
-- password_hash is a placeholder until the registration/login task picks a hashing method.
INSERT INTO users (id, role, hut_id, name, email, password_hash) VALUES
    (1, 'warden',   1, 'Wanda Warden',   'warden@hut.test',   'TO_BE_SET_BY_LOGIN_TASK'),
    (2, 'employee', 1, 'Eric Employee',  'employee@hut.test', 'TO_BE_SET_BY_LOGIN_TASK'),
    (3, 'hiker', NULL, 'Hanna Hiker',    'hiker@hut.test',    'TO_BE_SET_BY_LOGIN_TASK');

INSERT INTO dining_tables (id, hut_id, label, seats) VALUES
    (1, 1, 'T1', 2),
    (2, 1, 'T2', 4),
    (3, 1, 'T3', 4),
    (4, 1, 'T4', 6),
    (5, 1, 'T5', 8);

-- Ranges are [start_time, end_time): a slot at 12:00 is lunch, not breakfast.
-- Steps give the slot start times, e.g. lunch 12:00, 13:00, 14:00.
INSERT INTO meals (id, hut_id, meal_type, start_time, end_time, step_minutes) VALUES
    (1, 1, 'breakfast', '09:00', '12:00', 30),
    (2, 1, 'lunch',     '12:00', '15:00', 60),
    (3, 1, 'aperitivo', '15:00', '18:00', 30),
    (4, 1, 'dinner',    '18:00', '21:00', 60);

INSERT INTO menus (meal_id, name, description) VALUES
    (1, 'Continental', 'Bread, butter, jam, yogurt, coffee or tea'),
    (2, 'Mountain lunch', 'Polenta with cheese and a dessert'),
    (2, 'Vegetarian lunch', 'Vegetable soup and a dessert'),
    (3, 'Aperitivo', 'Local cured meats, cheese and a drink'),
    (4, 'Hut dinner', 'Pasta, main course and dessert'),
    (4, 'Vegetarian dinner', 'Pasta, vegetable main course and dessert');
