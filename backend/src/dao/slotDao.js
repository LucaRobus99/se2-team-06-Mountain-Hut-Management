import { createExecutorOf } from './executor.js';

/**
 * DAO for slots and their tables.
 * Methods take an optional executor first (see executor.js).
 */
/** The one free-seats query, shared by the single-slot and multi-slot lookups. */
async function tablesWithFree(exec, slotIds) {
  if (slotIds.length === 0) return [];
  const placeholders = slotIds.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await exec.query(
    `SELECT st.slot_id,
            dt.id,
            dt.label,
            st.seats,
            st.seats - COALESCE((
              SELECT SUM(bs.seats)
              FROM booking_seats bs
              JOIN bookings b ON b.id = bs.booking_id
              WHERE bs.table_id = dt.id
                AND b.slot_id = st.slot_id
                AND b.status = 'confirmed'
            ), 0) AS free
     FROM slot_tables st
     JOIN dining_tables dt ON dt.id = st.table_id
     WHERE st.slot_id IN (${placeholders})
     ORDER BY st.slot_id, dt.id`,
    slotIds
  );
  return rows;
}

export function createSlotDao(db) {
  const executorOf = createExecutorOf(db);

  return {
    async findById(...args) {
      const { db: exec, args: a } = executorOf(args);
      const slotId = a[0];
      const { rows } = await exec.query(
        `SELECT s.id, s.date, s.start_time, s.end_time, s.status, m.meal_type AS meal
         FROM slots s
         LEFT JOIN meals m ON m.id = s.meal_id
         WHERE s.id = $1`,
        [slotId]
      );
      return rows[0] ?? null;
    },

    async listByDate(...args) {
      const { db: exec, args: a } = executorOf(args);
      const date = a[0];
      const { rows } = await exec.query(
        `SELECT s.id, s.date, s.start_time, s.end_time, s.status, m.meal_type AS meal
         FROM slots s
         LEFT JOIN meals m ON m.id = s.meal_id
         WHERE s.date = $1
         ORDER BY s.start_time, s.id`,
        [date]
      );
      return rows;
    },

    /** The meal whose range [start_time, end_time) contains `time`, or null. */
    async findMealAt(...args) {
      const { db: exec, args: a } = executorOf(args);
      const time = a[0];
      const { rows } = await exec.query(
        `SELECT id, meal_type, start_time, end_time
         FROM meals
         WHERE start_time <= $1 AND $1 < end_time`,
        [time]
      );
      return rows[0] ?? null;
    },

    /**
     * Tables assigned to the slot as { slot_id, id, label, seats, free }: the seats
     * the table has in this slot and the seats not taken by confirmed bookings.
     * A slot without rows in `slot_tables` has no tables and therefore zero
     * capacity (issue #17). There is deliberately no fallback to all tables.
     */
    async getTablesWithFreeForSlot(...args) {
      const { db: exec, args: a } = executorOf(args);
      return tablesWithFree(exec, [a[0]]);
    },

    /** Same rows for several slots in one query (slot lists), ordered by slot then table. */
    async getTablesWithFreeForSlots(...args) {
      const { db: exec, args: a } = executorOf(args);
      return tablesWithFree(exec, a[0]);
    },

    /** The table set of a slot as { tableId, seats }, used to copy it to a new slot. */
    async getTableSetForSlot(...args) {
      const { db: exec, args: a } = executorOf(args);
      const slotId = a[0];
      const { rows } = await exec.query(
        `SELECT table_id AS "tableId", seats FROM slot_tables WHERE slot_id = $1 ORDER BY table_id`,
        [slotId]
      );
      return rows;
    },

    async createSlot(...args) {
      const { db: exec, args: a } = executorOf(args);
      const slot = a[0];
      const { rows } = await exec.query(
        `INSERT INTO slots (date, start_time, end_time, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [slot.date, slot.startTime, slot.endTime ?? null, slot.status ?? 'available']
      );
      return rows[0].id;
    },

    /** Adds a table to the slot with the seats it has in this slot only. */
    async addTableToSlot(...args) {
      const { db: exec, args: a } = executorOf(args);
      const slotId = a[0];
      const tableId = a[1];
      const seats = a[2];
      await exec.query(
        `INSERT INTO slot_tables (slot_id, table_id, seats) VALUES ($1, $2, $3)`,
        [slotId, tableId, seats]
      );
    },

    async findTableByLabel(...args) {
      const { db: exec, args: a } = executorOf(args);
      const label = a[0];
      const { rows } = await exec.query(
        `SELECT id FROM dining_tables WHERE label = $1`,
        [label]
      );
      return rows[0] ?? null;
    },

    async createTable(...args) {
      const { db: exec, args: a } = executorOf(args);
      const table = a[0];
      const { rows } = await exec.query(
        `INSERT INTO dining_tables (label) VALUES ($1) RETURNING id`,
        [table.label]
      );
      return rows[0].id;
    },
  };
}
