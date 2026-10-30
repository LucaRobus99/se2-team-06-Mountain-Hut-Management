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
        `SELECT s.id, s.hut_id, s.date, s.start_time, s.end_time, s.status, m.meal_type AS meal
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
        `SELECT s.id, s.hut_id, s.date, s.start_time, s.end_time, s.status, m.meal_type AS meal
         FROM slots s
         LEFT JOIN meals m ON m.id = s.meal_id
         WHERE s.hut_id = $1 AND s.date = $2
         ORDER BY s.start_time, s.id`,
        [hutId, date]
      );
      return rows;
    },

    async listByHut(...args) {
      const { db: exec, args: a } = executorOf(args);
      const hutId = a[0];
      const date = a[1];
      const params = [hutId];
      let sql = `SELECT s.id, s.hut_id, s.date, s.start_time, s.end_time, s.status, m.meal_type AS meal
         FROM slots s
         LEFT JOIN meals m ON m.id = s.meal_id
         WHERE s.hut_id = $1`;
      if (date) {
        sql += ' AND s.date = $2';
        params.push(date);
      }
      sql += ' ORDER BY s.date, s.start_time, s.id';
      const { rows } = await exec.query(sql, params);
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

    async getTableIdsForSlot(...args) {
      const { db: exec, args: a } = executorOf(args);
      const slotId = a[0];
      const { rows } = await exec.query(
        `SELECT table_id FROM slot_tables WHERE slot_id = $1`,
        [slotId]
      );
      return rows.map((r) => r.table_id);
    },

    async createSlot(...args) {
      const { db: exec, args: a } = executorOf(args);
      const slot = a[0];
      const { rows } = await exec.query(
        `INSERT INTO slots (hut_id, date, start_time, end_time, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [slot.hutId, slot.date, slot.startTime, slot.endTime ?? null, slot.status ?? 'available']
      );
      return rows[0].id;
    },

    async addTableToSlot(...args) {
      const { db: exec, args: a } = executorOf(args);
      const slotId = a[0];
      const tableId = a[1];
      await exec.query(
        `INSERT INTO slot_tables (slot_id, table_id) VALUES ($1, $2)`,
        [slotId, tableId]
      );
    },

    async findTableByLabel(...args) {
      const { db: exec, args: a } = executorOf(args);
      const hutId = a[0];
      const label = a[1];
      const { rows } = await exec.query(
        `SELECT id, seats FROM dining_tables WHERE hut_id = $1 AND label = $2`,
        [hutId, label]
      );
      return rows[0] ?? null;
    },

    async createTable(...args) {
      const { db: exec, args: a } = executorOf(args);
      const table = a[0];
      const { rows } = await exec.query(
        `INSERT INTO dining_tables (hut_id, label, seats) VALUES ($1, $2, $3) RETURNING id`,
        [table.hutId, table.label, table.seats]
      );
      return rows[0].id;
    },

    async updateTableSeats(...args) {
      const { db: exec, args: a } = executorOf(args);
      const tableId = a[0];
      const seats = a[1];
      await exec.query(`UPDATE dining_tables SET seats = $2 WHERE id = $1`, [tableId, seats]);
    },
  };
}
