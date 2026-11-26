import { createExecutorOf } from './executor.js';

/**
 * DAO for slots and their tables.
 * Methods take an optional executor first (see executor.js).
 */
/** The one free-seats query, shared by the single-slot and multi-slot lookups. */
async function tablesWithFree(exec, slotIds, exceptBookingId = null) {
  if (slotIds.length === 0) return [];
  const placeholders = slotIds.map((_, i) => `$${i + 1}`).join(', ');
  const excludeBooking = exceptBookingId === null ? '' : `AND b.id <> $${slotIds.length + 1}`;
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
                ${excludeBooking}
            ), 0) AS free
     FROM slot_tables st
     JOIN dining_tables dt ON dt.id = st.table_id
     WHERE st.slot_id IN (${placeholders})
     ORDER BY st.slot_id, dt.id`,
    exceptBookingId === null ? slotIds : [...slotIds, exceptBookingId]
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

    /** Look up the employee-selected meal category, independent of time of day. */
    async findMealByType(...args) {
      const { db: exec, args: a } = executorOf(args);
      const { rows } = await exec.query(
        'SELECT id, meal_type FROM meals WHERE meal_type = $1',
        [a[0]]
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
      return tablesWithFree(exec, a[0], a[1]);
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
        `INSERT INTO slots (date, start_time, end_time, meal_id, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [slot.date, slot.startTime, slot.endTime, slot.mealId, slot.status ?? 'available']
      );
      return rows[0].id;
    },

    /** Adds a table with its fixed catalog capacity. */
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
        `SELECT id, label, seats FROM dining_tables WHERE label = $1`,
        [label]
      );
      return rows[0] ?? null;
    },

    async createTable(...args) {
      const { db: exec, args: a } = executorOf(args);
      const table = a[0];
      const { rows } = await exec.query(
        `INSERT INTO dining_tables (label, seats) VALUES ($1, $2) RETURNING id`,
        [table.label, table.seats]
      );
      return rows[0].id;
    },

    async listTimePatterns() {
      const { rows } = await db.query(`SELECT DISTINCT s.start_time AS "startTime",
        s.end_time AS "endTime", m.meal_type AS meal
        FROM slots s JOIN meals m ON m.id = s.meal_id
        ORDER BY "startTime", "endTime", meal`);
      return rows;
    },

  async listByDateRange(...args) {
      const { db: exec, args: a } = executorOf(args);
      const [start, end] = a;

      const { rows } = await exec.query(
          `SELECT id, date, start_time, end_time, status, meal_id
           FROM slots
           WHERE date BETWEEN $1 AND $2
           ORDER BY date, start_time`,
          [start, end]
      );

      return rows;
    },

    /** Foreign keys prevent removing tables referenced by slots or bookings. */
    async deleteTable(...args) {
      const { db: exec, args: a } = executorOf(args);
      const { rows } = await exec.query(
        'DELETE FROM dining_tables WHERE id = $1 RETURNING id', [a[0]]
      );
      return rows.length > 0;
    },

    async listTables() {
      const { rows } = await db.query('SELECT id, label, seats FROM dining_tables ORDER BY label, id');
      return rows;
  },

  /** Returns true if any slot in [start..end] has at least one confirmed booking. */
  async hasAnyConfirmedBookingInRange(...args) {
      const { db: exec, args: a } = executorOf(args);
      const [start, end] = a;
      const { rowCount } = await exec.query(
          `SELECT 1 FROM bookings b
           JOIN slots s ON s.id = b.slot_id
           WHERE s.date BETWEEN $1 AND $2
             AND b.status = 'confirmed'
           LIMIT 1`,
          [start, end]
      );
      return rowCount > 0;
  },

  /** Any reservation record prevents deleting its referenced slot. */
  async hasAnyBookingInRange(...args) {
    const { db: exec, args: [start, end] } = executorOf(args);
    const { rows } = await exec.query(
      `SELECT 1 FROM bookings b JOIN slots s ON s.id = b.slot_id
       WHERE s.date BETWEEN $1 AND $2 LIMIT 1`, [start, end]
    );
    return rows.length > 0;
  },

  async findByIdsInDateRange(...args) {
    const { db: exec, args: a } = executorOf(args);
    const [dates] = a;

    const { rows } = await exec.query(`
        SELECT
            s.*,
            COALESCE(
                json_agg(
                    json_build_object(
                        'tableId', st.table_id,
                        'seats', st.seats
                    )
                ) FILTER (WHERE st.table_id IS NOT NULL),
                '[]'::json
            ) AS tables
        FROM slots s
        LEFT JOIN slot_tables st ON st.slot_id = s.id
        WHERE s.date = ANY($1::text[])
        GROUP BY s.id
        ORDER BY s.date, s.start_time
    `, [dates]);

    return rows;
},

  /** Deletes all slots in [start..end]; slot_tables are removed via CASCADE. */
  async deleteSlotsByDateRange(...args) {
    const { db: exec, args: a } = executorOf(args);
    const [start, end] = a;
    await exec.query(
      `DELETE FROM slots WHERE date BETWEEN $1 AND $2`,
      [start, end]
    );
  },

    async getTableSetForSlots(...args) {
    const { db: exec, args: a } = executorOf(args);
    const [slotIds] = a;

    const { rows } = await exec.query(`
        SELECT slot_id, table_id, seats
        FROM slot_tables
        WHERE slot_id = ANY($1::int[])
        ORDER BY slot_id, table_id
    `, [slotIds]);

    const result = new Map();

    for (const slotId of slotIds) {
        result.set(slotId, []);
    }

    for (const row of rows) {
        result.get(row.slot_id).push({
            tableId: row.table_id,
            seats: row.seats
        });
    }

    return result;
},

  };
}
