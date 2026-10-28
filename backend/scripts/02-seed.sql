-- Sample data. Run automatically after 01-schema.sql when the database is created.
-- After changing this file, run `npm run db:reset`.

INSERT INTO huts (id, name) VALUES
    (1, 'Rifugio Demo');

-- Staff accounts are created here: only hikers can register themselves.
-- Passwords are never stored in plaintext: each value below is a salted scrypt
-- hash (format scrypt$<salt>$<hash>) of the sample password `password`.
INSERT INTO users (id, role, hut_id, name, email, password_hash) VALUES
    (1, 'warden',   1, 'Wanda Warden',   'warden@hut.test',   'scrypt$b579e19c0304b937e98e87377fb2fb2c$fa2f8f8a95bbe8e3dc12a0195fcffc42086343bb6685abf7fe7833eba659276b9d68dfab44c7b0818f6cc1c8fd1d0e6ef8084e9b7243076c08a056cafa640f86'),
    (2, 'employee', 1, 'Eric Employee',  'employee@hut.test', 'scrypt$cf8193e68c0f3e29e8e57477e4e586f8$065cbda19286dc583bf8f9a370f8fe1d8ba8d5296d9eb9af7ef24c18f4fce9a9ac25af63a48bf0006c76b06a6f603d56d58f2cb1e4351ca81b9ed721d1b77d50'),
    (3, 'hiker', NULL, 'Hanna Hiker',    'hiker@hut.test',    'scrypt$df80fa39d3fb605f025f7eaf4e76049f$c49784da2563ba3a995bad42f8c7da499fc9945bcc30d1c8604488648de2d65d1e81a83957713b2a846ea752e9dac1140023ae6fafb034719ae3cc00c59da855');

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
