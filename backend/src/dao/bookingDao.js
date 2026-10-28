/**
 * DAO for bookings and booking_seats.
 * Methods accept an optional first argument that may be a database/transaction
 * executor; when omitted, the bound database is used.
 */
export function createBookingDao(db) {
  const defaultDb = db;

  function executorOf(args) {
    const [first, ...rest] = args;
    if (first && typeof first.query === 'function') {
      return { db: first, args: rest };
    }
    return { db: defaultDb, args };
  }

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
          booking.contactName,
          booking.email,
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
      for (const a2 of assignments) {
        await exec.query(
          `INSERT INTO booking_seats (booking_id, table_id, seats) VALUES ($1, $2, $3)`,
          [bookingId, a2.tableId, a2.seats]
        );
      }
    },

    async getCreatedAt(...args) {
      const { db: exec, args: a } = executorOf(args);
      const bookingId = a[0];
      const { rows } = await exec.query(
        `SELECT created_at FROM bookings WHERE id = $1`,
        [bookingId]
      );
      return rows[0]?.created_at ?? null;
    },
  };
}