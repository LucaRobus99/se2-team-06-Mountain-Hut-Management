import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../helpers/dbHelper.js';
import { createBookingDao } from '../../../src/dao/bookingDao.js';

describe('BookingDao - Integration Tests', () => {
  let db;
  let bookingDao;

  beforeEach(() => {
    // Initialize a clean in-memory SQLite database with schema and seed data
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

      // Retrieve the created booking and verify fields and joins matching the updated Dao query
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

  });

  describe('insertSeats and getSeatAssignments', () => {
    
    it('should insert seat assignments for a booking and retrieve them correctly ordered', async () => {
      // First, create a booking to link seats to
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

      // Retrieve seat assignments and verify
      const retrievedSeats = await bookingDao.getSeatAssignments(bookingId);
      expect(retrievedSeats).toBeInstanceOf(Array);
      expect(retrievedSeats.length).toBe(2);
      expect(retrievedSeats[0]).toHaveProperty('tableId', 1);
      expect(retrievedSeats[0]).toHaveProperty('tableLabel', 'T1');
      expect(retrievedSeats[0]).toHaveProperty('seats', 2);
      expect(retrievedSeats[1]).toHaveProperty('tableId', 2);
      expect(retrievedSeats[1]).toHaveProperty('seats', 1);
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

  describe('insertRequirements and getRequirements', () => {
    it('should successfully save and retrieve party requirements and allergy flags for a booking', async () => {
      // 1. Create a booking
      const bookingId = await bookingDao.create({
        slotId: 3,
        hikerId: 3,
        contactName: 'Hanna Hiker',
        email: 'hiker@hut.test',
        partySize: 2,
      });

      // 2. Insert requirements with mixed boolean/number allergy flags
      const requirementsToInsert = [
        { description: '1 guest with severe peanut allergy', allergies: true },
        { description: '1 vegetarian guest', allergies: false },
      ];

      await bookingDao.insertRequirements(bookingId, requirementsToInsert);

      // 3. Retrieve and verify requirements from the database
      const retrievedRequirements = await bookingDao.getRequirements(bookingId);
      expect(retrievedRequirements).toBeInstanceOf(Array);
      expect(retrievedRequirements.length).toBe(2);

      expect(retrievedRequirements[0]).toMatchObject({
        bookingId: bookingId,
        description: '1 guest with severe peanut allergy',
        allergies: 1, // Stored as integer in SQLite
      });

      expect(retrievedRequirements[1]).toMatchObject({
        bookingId: bookingId,
        description: '1 vegetarian guest',
        allergies: 0,
      });
    });

    it('should return an empty array if a booking has no requirements', async () => {
      const bookingId = await bookingDao.create({
        slotId: 5,
        hikerId: 3,
        contactName: 'Hanna Hiker',
        email: 'hiker@hut.test',
        partySize: 1,
      });

      const requirements = await bookingDao.getRequirements(bookingId);
      expect(requirements).toEqual([]);
    });
  });

});