import { describe, it, expect } from 'vitest';
import { getAvailableSlots, getSlotSeating, createBooking } from '../../../src/api/booking.js';

describe('Booking API Mock - White-Box Unit Tests', () => {
  
  const validHiker = {
    id: 1,
    displayName: 'Test Hiker',
    email: 'hiker@test.com',
    phone: '123456789',
    role: 'hiker'
  };

  const invalidUser = {
    id: 2,
    displayName: 'Staff Member',
    email: 'staff@test.com',
    role: 'employee'
  };

  describe('getAvailableSlots', () => {
    it('should throw a validation error if partySize is not a positive integer', async () => {
      await expect(getAvailableSlots({ date: '2026-11-15', meal: 'lunch', partySize: 0 }))
        .rejects.toThrow('Number of guests must be a positive integer.');
    });

    it('should throw a validation error if date or meal is missing', async () => {
      await expect(getAvailableSlots({ date: '', meal: 'lunch', partySize: 2 }))
        .rejects.toThrow('Please select a date and a meal.');
    });

    it('should return available slots for a valid query', async () => {
      const result = await getAvailableSlots({ date: '2026-11-15', meal: 'lunch', partySize: 2 });
      
      expect(result).toHaveProperty('hutId', 1);
      expect(result).toHaveProperty('date', '2026-11-15');
      expect(result).toHaveProperty('meal', 'lunch');
      expect(result).toHaveProperty('slots');
      expect(result.slots).toBeInstanceOf(Array);
      expect(result.slots.length).toBeGreaterThan(0);
    });
  });

  describe('getSlotSeating', () => {
    it('should return seating details and fit type for a valid slot', async () => {
      // Otteniamo prima uno slot valido
      const available = await getAvailableSlots({ date: '2026-11-16', meal: 'dinner', partySize: 2 });
      const slotId = available.slots[0].id;

      const seating = await getSlotSeating({ slotId, partySize: 2 });
      
      expect(seating).toHaveProperty('slotId', slotId);
      expect(seating).toHaveProperty('partySize', 2);
      expect(seating).toHaveProperty('fit');
      expect(seating).toHaveProperty('seatAssignments');
      expect(seating.seatAssignments).toBeInstanceOf(Array);
    });
  });

  describe('createBooking', () => {
    it('should throw UNAUTHENTICATED error if user is not provided', async () => {
      await expect(createBooking({ slotId: 1, partySize: 2 }, null))
        .rejects.toThrow('Please log in to book.');
    });

    it('should throw FORBIDDEN error if user role is not hiker', async () => {
      await expect(createBooking({ slotId: 1, partySize: 2 }, invalidUser))
        .rejects.toThrow('Only Hikers can book online.');
    });

    it('should successfully create a booking for an authenticated hiker', async () => {
      // Prepariamo uno slot valido
      const available = await getAvailableSlots({ date: '2026-11-18', meal: 'breakfast', partySize: 2 });
      const slotId = available.slots[0].id;

      const booking = await createBooking({
        slotId,
        partySize: 2,
        contactName: 'Test Hiker',
        email: 'hiker@test.com',
        phone: '123456789'
      }, validHiker);

      expect(booking).toHaveProperty('id');
      expect(booking).toHaveProperty('status', 'confirmed');
      expect(booking).toHaveProperty('partySize', 2);
      expect(booking).toHaveProperty('hikerId', validHiker.id);
    });
  });

});