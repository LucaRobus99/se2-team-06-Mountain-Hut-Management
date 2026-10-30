import { describe, expect, it } from 'vitest';
import { createSqliteDb } from '../src/db/sqlite.js';

// These tests start from an empty slots table, so the seeded slots are removed.
async function createEmptyDb() {
  const db = createSqliteDb(':memory:');
  await db.query('DELETE FROM slot_tables');
  await db.query('DELETE FROM slots');
  return db;
}

describe('SQLite transaction helper', () => {
  it('commits when the function succeeds', async () => {
    const db = await createEmptyDb();
    try {
      await db.transaction(async (tx) => {
        await tx.query("INSERT INTO slots (hut_id, date, start_time) VALUES (1, '2026-12-01', '12:00')");
      });
      const { rows } = await db.query('SELECT status FROM slots');
      expect(rows).toEqual([{ status: 'available' }]);
    } finally {
      await db.close();
    }
  });

  it('rolls back when the function throws', async () => {
    const db = await createEmptyDb();
    try {
      await expect(db.transaction(async (tx) => {
        await tx.query("INSERT INTO slots (hut_id, date, start_time) VALUES (1, '2026-12-01', '12:00')");
        throw new Error('not enough seats');
      })).rejects.toThrow('not enough seats');

      const { rowCount } = await db.query('SELECT id FROM slots');
      expect(rowCount).toBe(0);
    } finally {
      await db.close();
    }
  });

  it('runs transactions one at a time, so the first one saved wins', async () => {
    const db = await createEmptyDb();
    try {
      await db.query("INSERT INTO slots (id, hut_id, date, start_time) VALUES (1, 1, '2026-12-01', '12:00')");
      const seatsLeft = 2;

      // Two bookings for the last 2 seats, started at the same moment.
      const book = (name) => db.transaction(async (tx) => {
        const { rows } = await tx.query('SELECT COALESCE(SUM(party_size), 0) AS taken FROM bookings WHERE slot_id = 1');
        if (rows[0].taken + 2 > seatsLeft) throw new Error('not enough seats');
        await tx.query(
          'INSERT INTO bookings (slot_id, created_by, contact_name, email, party_size) VALUES (1, 3, $1, $2, 2)',
          [name, `${name}@test`]
        );
      });

      const results = await Promise.allSettled([book('first'), book('second')]);
      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);

      const { rows } = await db.query('SELECT contact_name FROM bookings');
      expect(rows).toEqual([{ contact_name: 'first' }]);
    } finally {
      await db.close();
    }
  });
});
