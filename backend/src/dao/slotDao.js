/**
 * DAO for slots and their tables.
 * Methods accept an optional first argument that may be a database/transaction
 * executor; when omitted, the bound database is used.
 */
export function createSlotDao(db) {
  const defaultDb = db;

  function executorOf(args) {
    const [first, ...rest] = args;
    if (first && typeof first.query === 'function') {
      return { db: first, args: rest };
    }
    return { db: defaultDb, args };
  }

  return {
    async findById(...args) {
      const { db: exec, args: a } = executorOf(args);
      const slotId = a[0];
      const { rows } = await exec.query(
        `SELECT s.id, s.hut_id, s.date, s.start_time, s.status, m.meal_type AS meal
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
        `SELECT s.id, s.hut_id, s.date, s.start_time, s.status, m.meal_type AS meal
         FROM slots s
         LEFT JOIN meals m ON m.id = s.meal_id
         WHERE s.date = $1
         ORDER BY s.start_time, s.id`,
        [date]
      );
      return rows;
    },

    async getTablesForSlot(...args) {
      const { db: exec, args: a } = executorOf(args);
      const slotId = a[0];
      // If slot_tables has entries for this slot, use them; otherwise all tables of the hut.
      const { rows: linked } = await exec.query(
        `SELECT COUNT(*) AS c FROM slot_tables WHERE slot_id = $1`,
        [slotId]
      );
      const hasLinked = Number(linked[0]?.c ?? 0) > 0;

      let sql;
      if (hasLinked) {
        sql = `SELECT dt.id, dt.label, dt.seats
               FROM dining_tables dt
               JOIN slot_tables st ON st.table_id = dt.id
               WHERE st.slot_id = $1
               ORDER BY dt.id`;
      } else {
        sql = `SELECT dt.id, dt.label, dt.seats
               FROM dining_tables dt
               WHERE dt.hut_id = (SELECT hut_id FROM slots WHERE id = $1)
               ORDER BY dt.id`;
      }
      const { rows } = await exec.query(sql, [slotId]);
      return rows;
    },

    async getFreeSeats(...args) {
      const { db: exec, args: a } = executorOf(args);
      const slotId = a[0];
      // Returns rows { table_id, free }
      const { rows: tables } = await exec.query(
        `SELECT dt.id AS table_id, dt.seats AS seats
         FROM dining_tables dt
         WHERE dt.hut_id = (SELECT hut_id FROM slots WHERE id = $1)
            OR dt.id IN (SELECT table_id FROM slot_tables WHERE slot_id = $1)`,
        [slotId]
      );
      // Compute free per table.
      const result = [];
      for (const t of tables) {
        const { rows } = await exec.query(
          `SELECT COALESCE(SUM(bs.seats), 0) AS taken
           FROM booking_seats bs
           JOIN bookings b ON b.id = bs.booking_id
           WHERE bs.table_id = $1 AND b.slot_id = $2 AND b.status = 'confirmed'`,
          [t.table_id, slotId]
        );
        result.push({ table_id: t.table_id, free: Number(t.seats) - Number(rows[0]?.taken ?? 0) });
      }
      // De-duplicate (tables may appear twice).
      const map = new Map();
      for (const r of result) map.set(r.table_id, r.free);
      return map;
    },
  };
}