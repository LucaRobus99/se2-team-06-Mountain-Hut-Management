import { createExecutorOf } from './executor.js';

/**
 * DAO for bookings and booking_seats.
 * Methods take an optional executor first (see executor.js).
 */
export function createBookingDao(db) {
  const executorOf = createExecutorOf(db);

  return {
    async create(...args) {
      const { db: exec, args: a } = executorOf(args);
      const booking = a[0];
      const { rows } = await exec.query(
        `INSERT INTO bookings (slot_id, hiker_id, created_by, contact_name, email, phone, party_size, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed')
         RETURNING id`,
        [
          booking.slotId,
          booking.hikerId ?? null,
          booking.createdBy ?? null,
          booking.contactName ?? null,
          booking.email ?? null,
          booking.phone ?? null,
          booking.partySize,
        ]
      );
      return rows[0].id;
    },

    async insertSeats(...args) {
      const { db: exec, args: a } = executorOf(args);
      const bookingId = a[0];
      const assignments = a[1];
      for (const assignment of assignments) {
        await exec.query(
          `INSERT INTO booking_seats (booking_id, table_id, seats) VALUES ($1, $2, $3)`,
          [bookingId, assignment.tableId, assignment.seats]
        );
      }
    },

    async findById(...args) {
      const { db: exec, args: a } = executorOf(args);
      const bookingId = a[0];
      const { rows } = await exec.query(
        `SELECT b.id, b.slot_id, b.hiker_id, b.created_by, b.contact_name, b.email, b.phone,
                b.party_size, b.status, b.created_at,
                s.date AS slot_date, s.start_time AS slot_start_time, s.end_time AS slot_end_time,
                s.status AS slot_status, m.meal_type AS meal
         FROM bookings b
         JOIN slots s ON s.id = b.slot_id
         LEFT JOIN meals m ON m.id = s.meal_id
         WHERE b.id = $1`,
        [bookingId]
      );
      return rows[0] ?? null;
    },


    /** MH-06: update the mutable fields (slot and party size) of a booking. */
    async update(...args) {
      const { db: exec, args: a } = executorOf(args);
      const bookingId = a[0];
      const booking = a[1] ?? {};
      await exec.query(
        `UPDATE bookings SET slot_id = $2, party_size = $3 WHERE id = $1`,
        [bookingId, booking.slotId, booking.partySize]
      );
    },

    /** MH-08 (later MH-15/MH-17): change the status, e.g. to 'cancelled'. */
    async updateStatus(...args) {
      const { db: exec, args: a } = executorOf(args);
      await exec.query(`UPDATE bookings SET status = $2 WHERE id = $1`, [a[0], a[1]]);
    },

    /** MH-06: release the seats a booking currently holds before re-allocating. */
    async deleteSeats(...args) {
      const { db: exec, args: a } = executorOf(args);
      await exec.query('DELETE FROM booking_seats WHERE booking_id = $1', [a[0]]);
    },

    /** MH-06: every booking owned by a hiker, newest slot first (same row shape as findById). */
    async listByHiker(...args) {
      const { db: exec, args: a } = executorOf(args);
      const hikerId = a[0];
      const { rows } = await exec.query(
        `SELECT b.id, b.slot_id, b.hiker_id, b.created_by, b.contact_name, b.email, b.phone,
                b.party_size, b.status, b.created_at,
                s.date AS slot_date, s.start_time AS slot_start_time, s.end_time AS slot_end_time,
                s.status AS slot_status, m.meal_type AS meal
         FROM bookings b
         JOIN slots s ON s.id = b.slot_id
         LEFT JOIN meals m ON m.id = s.meal_id
         WHERE b.hiker_id = $1
         ORDER BY s.date DESC, s.start_time DESC, b.id DESC`,
        [hikerId]
      );
      return rows;
    },


    async getSeatAssignments(...args) {
      const { db: exec, args: a } = executorOf(args);
      const bookingId = a[0];
      const { rows } = await exec.query(
        `SELECT bs.table_id AS tableId, dt.label AS tableLabel, bs.seats
         FROM booking_seats bs
         JOIN dining_tables dt ON dt.id = bs.table_id
         WHERE bs.booking_id = $1
         ORDER BY dt.id`,
        [bookingId]
      );
      return rows;
    },

    /** A hiker may have only one confirmed booking per slot (issue #25). */
    async findConfirmedByHikerAndSlot(...args) {
      const { db: exec, args: a } = executorOf(args);
      const hikerId = a[0];
      const slotId = a[1];
      const { rows } = await exec.query(
        `SELECT id FROM bookings
         WHERE hiker_id = $1 AND slot_id = $2 AND status = 'confirmed'
         LIMIT 1`,
        [hikerId, slotId]
      );
      return rows[0] ?? null;
    },

    /**
     * MH-05: save a booking's party requirements, in the given order.
     * `requirements` is the list returned by parseRequirements().
     */
    async insertRequirements(...args) {
      const { db: exec, args: a } = executorOf(args);
      const [bookingId, requirements] = a;
      for (const { description, allergies } of requirements) {
        await exec.query(
          `INSERT INTO booking_requirements (booking_id, description, allergies) VALUES ($1, $2, $3)`,
          [bookingId, description, allergies ? 1 : 0]
        );
      }
    },

    /**
     * MH-06: replace the whole list (an empty list clears it). Run it inside the
     * caller's transaction so a failed change keeps the previous list.
     */
    async replaceRequirements(...args) {
      const { db: exec, args: a } = executorOf(args);
      const [bookingId, requirements] = a;
      await exec.query(`DELETE FROM booking_requirements WHERE booking_id = $1`, [bookingId]);
      await this.insertRequirements(exec, bookingId, requirements);
    },

    /** MH-05: a booking's requirements as [{ description, allergies: boolean }]. */
    async getRequirements(...args) {
      const { db: exec, args: a } = executorOf(args);
      const { rows } = await exec.query(
        `SELECT description, allergies
         FROM booking_requirements
         WHERE booking_id = $1
         ORDER BY id`,
        [a[0]]
      );
      return rows.map(toRequirement);
    },

    /**
     * Requirements of several bookings in one query (booking lists).
     * Returns a Map bookingId -> list; bookings without requirements get [].
     */
    async getRequirementsByBookingIds(...args) {
      const { db: exec, args: a } = executorOf(args);
      const ids = a[0];
      const byBooking = new Map(ids.map((id) => [id, []]));
      if (ids.length === 0) return byBooking;
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      const { rows } = await exec.query(
        `SELECT booking_id AS bookingId, description, allergies
         FROM booking_requirements
         WHERE booking_id IN (${placeholders})
         ORDER BY booking_id, id`,
        ids
      );
      for (const row of rows) byBooking.get(row.bookingId)?.push(toRequirement(row));
      return byBooking;
    },
  };
}

/** SQLite stores the allergy flag as 0/1; the API uses booleans. */
function toRequirement(row) {
  return { description: row.description, allergies: row.allergies === 1 };
}
