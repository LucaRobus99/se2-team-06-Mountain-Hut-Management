-- Sample data. Run automatically after 01-schema.sql when the database is created.
-- After changing this file, run `npm run db:reset`.

-- Staff accounts are created here: only hikers can register themselves.
-- Passwords are never stored in plaintext: each value below is a salted scrypt
-- hash (format scrypt$<salt>$<hash>) of the sample password `password`.
INSERT INTO users (id, role, name, email, password_hash) VALUES
    (1, 'warden',   'Wanda Warden',   'warden@hut.test',   'scrypt$b579e19c0304b937e98e87377fb2fb2c$fa2f8f8a95bbe8e3dc12a0195fcffc42086343bb6685abf7fe7833eba659276b9d68dfab44c7b0818f6cc1c8fd1d0e6ef8084e9b7243076c08a056cafa640f86'),
    (2, 'employee', 'Eric Employee',  'employee@hut.test', 'scrypt$cf8193e68c0f3e29e8e57477e4e586f8$065cbda19286dc583bf8f9a370f8fe1d8ba8d5296d9eb9af7ef24c18f4fce9a9ac25af63a48bf0006c76b06a6f603d56d58f2cb1e4351ca81b9ed721d1b77d50'),
    (3, 'hiker',    'Hanna Hiker',    'hiker@hut.test',    'scrypt$df80fa39d3fb605f025f7eaf4e76049f$c49784da2563ba3a995bad42f8c7da499fc9945bcc30d1c8604488648de2d65d1e81a83957713b2a846ea752e9dac1140023ae6fafb034719ae3cc00c59da855');

-- Table labels only; the seats of each table are set per slot below.
INSERT INTO dining_tables (id, label) VALUES
    (1, 'T1'),
    (2, 'T2'),
    (3, 'T3'),
    (4, 'T4'),
    (5, 'T5');

-- Ranges are [start_time, end_time): a slot at 12:00 is lunch, not breakfast.
INSERT INTO meals (id, meal_type, start_time, end_time) VALUES
    (1, 'breakfast', '09:00', '12:00'),
    (2, 'lunch',     '12:00', '15:00'),
    (3, 'aperitivo', '15:00', '18:00'),
    (4, 'dinner',    '18:00', '21:00');

INSERT INTO menus (meal_id, name, description) VALUES
    (1, 'Continental', 'Bread, butter, jam, yogurt, coffee or tea'),
    (2, 'Mountain lunch', 'Polenta with cheese and a dessert'),
    (2, 'Vegetarian lunch', 'Vegetable soup and a dessert'),
    (3, 'Aperitivo', 'Local cured meats, cheese and a drink'),
    (4, 'Hut dinner', 'Pasta, main course and dessert'),
    (4, 'Vegetarian dinner', 'Pasta, vegetable main course and dessert');

-- Sample slots on two days, back to back but never overlapping. meal_id is filled
-- in by the slots triggers from start_time, which must fall inside a meal range.
INSERT INTO slots (id, date, start_time, end_time, status) VALUES
    (1,  '2026-11-15', '09:00', '09:30', 'available'),
    (2,  '2026-11-15', '09:30', '10:00', 'available'),
    (3,  '2026-11-15', '12:00', '13:00', 'available'),
    (4,  '2026-11-15', '13:00', '14:00', 'available'),
    (5,  '2026-11-15', '15:30', '16:00', 'available'),
    (6,  '2026-11-15', '19:00', '20:00', 'available'),
    (7,  '2026-11-15', '20:00', '21:00', 'off'),
    (8,  '2026-11-16', '09:00', '09:30', 'available'),
    (9,  '2026-11-16', '12:00', '13:00', 'available'),
    (10, '2026-11-16', '19:00', '20:00', 'available');

-- Table set of each slot: table and its seats in that slot (T1 = 2, T2/T3 = 4,
-- T4 = 6, T5 = 8). Slot 7 is off and slot 8 has no tables (zero capacity, issue #17).
INSERT INTO slot_tables (slot_id, table_id, seats) VALUES
    (1, 1, 2), (1, 2, 4),
    (2, 1, 2), (2, 2, 4), (2, 3, 4),
    (3, 1, 2), (3, 2, 4), (3, 3, 4), (3, 4, 6), (3, 5, 8),
    (4, 2, 4), (4, 3, 4), (4, 4, 6),
    (5, 1, 2), (5, 2, 4),
    (6, 1, 2), (6, 2, 4), (6, 3, 4), (6, 4, 6), (6, 5, 8),
    (7, 4, 6), (7, 5, 8),
    (9, 2, 4), (9, 4, 6),
    (10, 3, 4), (10, 4, 6), (10, 5, 8);
