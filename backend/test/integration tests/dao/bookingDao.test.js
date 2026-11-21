import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../helpers/dbHelper.js';
import { createBookingDao } from '../../../src/dao/bookingDao.js';

describe('BookingDao - Integration Tests', () => {
  let db;
  let bookingDao;

  beforeEach(() => {
    // Initialize a clean test database (PostgreSQL) with schema and seed data
    db = createTestDb();
    bookingDao = createBookingDao(db);
  });

  afterEach(async () => {
    // Close the database connection after each test
    await db.close();
  });

  describe('create and findById', () => {
    it('should successfully create a new booking and retrieve it by ID with joined slot and meal details', async () => {
      const newBooking = {
        slotId: 1,
        hikerId: 3, // Hanna Hiker from seed
        createdBy: null,
        contactName: 'Hanna Hiker',
        email: 'hiker@hut.test',
        phone: '1234567890',
        partySize: 2,
      };

      const bookingId = await bookingDao.create(newBooking);
      expect(bookingId).toBeDefined();
      expect(typeof bookingId).toBe('number');

      // Retrieve the created booking and verify fields and joins matching the DAO query
      const retrieved = await bookingDao.findById(bookingId);
      expect(retrieved).toBeDefined();
      expect(retrieved).not.toBeNull();
      expect(retrieved.id).toBe(bookingId);
      expect(retrieved.slot_id).toBe(1);
      expect(retrieved.hiker_id).toBe(3);
      expect(retrieved.created_by).toBeNull();
      expect(retrieved.contact_name).toBe('Hanna Hiker');
      expect(retrieved.email).toBe('hiker@hut.test');
      expect(retrieved.phone).toBe('1234567890');
      expect(retrieved.party_size).toBe(2);
      expect(retrieved.status).toBe('confirmed');
      expect(retrieved.slot_date).toBeDefined();
      expect(retrieved.slot_start_time).toBeDefined();
      expect(retrieved.meal).toBe('breakfast');
    });

    it('should successfully create a booking created by staff (createdBy set)', async () => {
      const staffBooking = {
        slotId: 2,
        hikerId: null,
        createdBy: 1, // Staff ID from seed
        contactName: 'Guest Visitor',
        email: 'guest@hut.test',
        phone: '9876543210',
        partySize: 4,
      };

      const bookingId = await bookingDao.create(staffBooking);
      const retrieved = await bookingDao.findById(bookingId);

      expect(retrieved.hiker_id).toBeNull();
      expect(retrieved.created_by).toBe(1);
      expect(retrieved.party_size).toBe(4);
    });

    it('should return null if booking ID does not exist', async () => {
      const booking = await bookingDao.findById(9999);
      expect(booking).toBeNull();
    });

    it('should enforce at most one confirmed booking per hiker and slot, allowing a new one after cancellation', async () => {
      const firstId = await bookingDao.create({
        slotId: 5,
        hikerId: 3,
        contactName: 'Hanna Hiker',
        partySize: 2,
      });

      await expect(
        bookingDao.create({
          slotId: 5,
          hikerId: 3,
          contactName: 'Hanna Hiker',
          partySize: 2,
        })
      ).rejects.toThrow();

      await bookingDao.cancelIfConfirmed(firstId);

      const secondId = await bookingDao.create({
        slotId: 5,
        hikerId: 3,
        contactName: 'Hanna Hiker',
        partySize: 2,
      });
      expect(secondId).toBeGreaterThan(firstId);
    });
  });

  describe('insertSeats, getSeatAssignments and deleteSeats', () => {
    it('should insert seat assignments for a booking and retrieve them correctly ordered', async () => {
      // Create a parent booking first
      const bookingId = await bookingDao.create({
        slotId: 2,
        hikerId: 3,
        contactName: 'Hanna Hiker',
        email: 'hiker@hut.test',
        partySize: 3,
      });

      const assignments = [
        { tableId: 1, seats: 2 },
        { tableId: 2, seats: 1 },
      ];

      await bookingDao.insertSeats(bookingId, assignments);

      // Retrieve seat assignments and verify table labels and seat counts
      const retrievedSeats = await bookingDao.getSeatAssignments(bookingId);
      expect(retrievedSeats).toBeInstanceOf(Array);
      expect(retrievedSeats.length).toBe(2);
      expect(retrievedSeats[0]).toHaveProperty('tableId', 1);
      expect(retrievedSeats[0]).toHaveProperty('tableLabel', 'T1');
      expect(retrievedSeats[0]).toHaveProperty('seats', 2);
      expect(retrievedSeats[1]).toHaveProperty('tableId', 2);
      expect(retrievedSeats[1]).toHaveProperty('tableLabel', 'T2');
      expect(retrievedSeats[1]).toHaveProperty('seats', 1);
    });

    it('should insert, retrieve, and delete seat assignments correctly', async () => {
      const bookingId = await bookingDao.create({
        slotId: 2,
        hikerId: 3,
        contactName: 'Hanna',
        partySize: 3,
      });

      const assignments = [
        { tableId: 1, seats: 2 },
        { tableId: 2, seats: 1 },
      ];

      await bookingDao.insertSeats(bookingId, assignments);

      const retrievedSeats = await bookingDao.getSeatAssignments(bookingId);
      expect(retrievedSeats.length).toBe(2);
      expect(retrievedSeats[0]).toMatchObject({ tableId: 1, seats: 2 });

      await bookingDao.deleteSeats(bookingId);
      const clearedSeats = await bookingDao.getSeatAssignments(bookingId);
      expect(clearedSeats).toEqual([]);
    });
  });

  describe('update and updateStatus', () => {
    it('should update mutable fields (slot_id and party_size)', async () => {
      const bookingId = await bookingDao.create({
        slotId: 1,
        hikerId: 3,
        contactName: 'Hanna',
        partySize: 2,
      });

      await bookingDao.update(bookingId, { slotId: 2, partySize: 5 });

      const retrieved = await bookingDao.findById(bookingId);
      expect(retrieved.slot_id).toBe(2);
      expect(retrieved.party_size).toBe(5);
    });

    it('should update booking status (e.g. to cancelled)', async () => {
      const bookingId = await bookingDao.create({
        slotId: 1,
        hikerId: 3,
        contactName: 'Hanna',
        partySize: 2,
      });

      await bookingDao.updateStatus(bookingId, 'cancelled');

      const retrieved = await bookingDao.findById(bookingId);
      expect(retrieved.status).toBe('cancelled');
    });
  });

  describe('listByHiker', () => {
    it('should return all bookings for a specific hiker sorted by slot date and start time descending', async () => {
      await bookingDao.create({ slotId: 1, hikerId: 3, contactName: 'Hanna', partySize: 2 });
      await bookingDao.create({ slotId: 2, hikerId: 3, contactName: 'Hanna', partySize: 1 });

      const bookings = await bookingDao.listByHiker(3);
      expect(bookings).toBeInstanceOf(Array);
      expect(bookings.length).toBeGreaterThanOrEqual(2);
      expect(bookings[0]).toHaveProperty('slot_date');
    });

    it('should order bookings by slot date descending and start time descending', async () => {
      const b1 = await bookingDao.create({ slotId: 1, hikerId: 3, contactName: 'Hanna', partySize: 2 });
      const b2 = await bookingDao.create({ slotId: 2, hikerId: 3, contactName: 'Hanna', partySize: 2 });

      const bookings = await bookingDao.listByHiker(3);
      const ids = bookings.map((b) => b.id);
      expect(ids).toContain(b1);
      expect(ids).toContain(b2);

      for (let i = 0; i < bookings.length - 1; i++) {
        const curr = bookings[i];
        const next = bookings[i + 1];
        const sameDate = curr.slot_date === next.slot_date;
        const sameStart = curr.slot_start_time === next.slot_start_time;

        if (!sameDate) {
          expect(curr.slot_date > next.slot_date).toBe(true);
        } else if (!sameStart) {
          expect(curr.slot_start_time > next.slot_start_time).toBe(true);
        } else {
          expect(curr.id >= next.id).toBe(true);
        }
      }
    });

    it('should return an empty array if the hiker has no bookings', async () => {
      const bookings = await bookingDao.listByHiker(9999);
      expect(bookings).toEqual([]);
    });
  });

  describe('findConfirmedByHikerAndSlot', () => {
    it('should find a confirmed booking for a specific hiker and slot', async () => {
      // Create a confirmed booking
      const bookingId = await bookingDao.create({
        slotId: 4,
        hikerId: 3,
        contactName: 'Hanna Hiker',
        email: 'hiker@hut.test',
        partySize: 2,
      });

      const found = await bookingDao.findConfirmedByHikerAndSlot(3, 4);
      expect(found).toBeDefined();
      expect(found).not.toBeNull();
      expect(found.id).toBe(bookingId);
    });

    it('should return null if no confirmed booking exists for that hiker and slot combination', async () => {
      const found = await bookingDao.findConfirmedByHikerAndSlot(3, 99);
      expect(found).toBeNull();
    });
  });

  describe('requirements management (insert, get, replace, getByBookingIds)', () => {
    it('should successfully save, retrieve and replace party requirements', async () => {
      const bookingId = await bookingDao.create({ slotId: 3, hikerId: 3, contactName: 'Hanna', partySize: 2 });

      await bookingDao.insertRequirements(bookingId, [
        { description: 'Peanut allergy', allergies: true },
      ]);

      let reqs = await bookingDao.getRequirements(bookingId);
      expect(reqs.length).toBe(1);
      expect(reqs[0]).toMatchObject({ description: 'Peanut allergy', allergies: true });

      // Replace existing requirements with a new entry
      await bookingDao.replaceRequirements(bookingId, [
        { description: 'Gluten free', allergies: false },
      ]);

      reqs = await bookingDao.getRequirements(bookingId);
      expect(reqs.length).toBe(1);
      expect(reqs[0]).toMatchObject({ description: 'Gluten free', allergies: false });
    });

    it('should preserve insertion order in getRequirements and clear requirements when replacing with []', async () => {
      const bookingId = await bookingDao.create({ slotId: 3, hikerId: 3, contactName: 'Hanna', partySize: 2 });

      await bookingDao.insertRequirements(bookingId, [
        { description: 'First req', allergies: false },
        { description: 'Second req', allergies: true },
      ]);

      const reqs = await bookingDao.getRequirements(bookingId);
      expect(reqs).toEqual([
        { description: 'First req', allergies: false },
        { description: 'Second req', allergies: true },
      ]);

      await bookingDao.replaceRequirements(bookingId, []);
      await expect(bookingDao.getRequirements(bookingId)).resolves.toEqual([]);
    });

    it('should fetch requirements by multiple booking IDs into a Map', async () => {
      const b1 = await bookingDao.create({ slotId: 1, hikerId: 3, contactName: 'H1', partySize: 1 });
      const b2 = await bookingDao.create({ slotId: 2, hikerId: 3, contactName: 'H2', partySize: 1 });

      await bookingDao.insertRequirements(b1, [{ description: 'Vegan', allergies: false }]);

      const map = await bookingDao.getRequirementsByBookingIds([b1, b2, 9999]);
      expect(map).toBeInstanceOf(Map);
      expect(map.get(b1)).toEqual([{ description: 'Vegan', allergies: false }]);
      expect(map.get(b2)).toEqual([]);
    });

    it('should return an empty Map when getRequirementsByBookingIds is called with an empty array', async () => {
      const map = await bookingDao.getRequirementsByBookingIds([]);
      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(0);
    });
  });

  describe('cancelIfConfirmed', () => {
    it('should successfully cancel a confirmed booking and return true', async () => {
      const bookingId = await bookingDao.create({
        slotId: 1,
        hikerId: 3,
        contactName: 'Hanna',
        partySize: 2,
      });

      const success = await bookingDao.cancelIfConfirmed(bookingId);
      expect(success).toBe(true);

      const retrieved = await bookingDao.findById(bookingId);
      expect(retrieved.status).toBe('cancelled');
    });

    it('should return false if the booking is already cancelled or does not exist', async () => {
      const bookingId = await bookingDao.create({
        slotId: 1,
        hikerId: 3,
        contactName: 'Hanna',
        partySize: 2,
      });

      // First cancellation succeeds
      await bookingDao.cancelIfConfirmed(bookingId);

      // Second cancellation fails because the booking is no longer 'confirmed'
      const successAgain = await bookingDao.cancelIfConfirmed(bookingId);
      expect(successAgain).toBe(false);

      // Non-existent booking ID returns false
      const successNonExistent = await bookingDao.cancelIfConfirmed(9999);
      expect(successNonExistent).toBe(false);
    });
  });
});