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
