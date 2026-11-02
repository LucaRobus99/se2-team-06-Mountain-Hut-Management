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
    
    it('should successfully create a new booking and retrieve it by ID with joined details', async () => {
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

      // Retrieve the created booking and verify fields and joins
      const retrieved = await bookingDao.findById(bookingId);
      expect(retrieved).toBeDefined();
      expect(retrieved).not.toBeNull();
      expect(retrieved.id).toBe(bookingId);
      expect(retrieved.slot_id).toBe(1);
      expect(retrieved.hiker_id).toBe(3);
      expect(retrieved.contact_name).toBe('Hanna Hiker');
      expect(retrieved.party_size).toBe(2);
      expect(retrieved.status).toBe('confirmed');
      expect(retrieved.hut_id).toBe(1);
      expect(retrieved.meal).toBe('breakfast');
    });

    it('should return null if booking ID does not exist', async () => {
      const booking = await bookingDao.findById(9999);
      expect(booking).toBeNull();
    });

  });

  describe('insertSeats and getSeatAssignments', () => {
    
    it('should insert seat assignments for a booking and retrieve them correctly', async () => {
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

});