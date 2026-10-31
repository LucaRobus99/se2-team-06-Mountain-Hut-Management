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
  };
}
