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
      const hutId = a[0];
      const date = a[1];
      const { rows } = await exec.query(
        `SELECT s.id, s.hut_id, s.date, s.start_time, s.status, m.meal_type AS meal
         FROM slots s
         LEFT JOIN meals m ON m.id = s.meal_id
         WHERE s.hut_id = $1 AND s.date = $2
         ORDER BY s.start_time, s.id`,
        [hutId, date]
      );
      return rows;
    },

    /**
     * Tables assigned to the slot, each with its free seats.
     * A slot without rows in `slot_tables` has no tables and therefore zero
     * capacity (issue #17). There is deliberately no fallback to all hut tables.
     */
    async getTablesWithFreeForSlot(...args) {
      const { db: exec, args: a } = executorOf(args);
      const slotId = a[0];
      const { rows } = await exec.query(
        `SELECT dt.id,
                dt.label,
                dt.seats,
                dt.seats - COALESCE((
                  SELECT SUM(bs.seats)
                  FROM booking_seats bs
                  JOIN bookings b ON b.id = bs.booking_id
                  WHERE bs.table_id = dt.id
                    AND b.slot_id = $1
                    AND b.status = 'confirmed'
                ), 0) AS free
         FROM slot_tables st
         JOIN dining_tables dt ON dt.id = st.table_id
         WHERE st.slot_id = $1
         ORDER BY dt.id`,
        [slotId]
      );
      return rows;
    },
  };
}
