import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../helpers/dbHelper.js';
import { createSlotDao } from '../../../src/dao/slotDao.js';

describe('SlotDao - Integration Tests', () => {
  let db;
  let slotDao;

  beforeEach(() => {
    // Initialize a clean in-memory SQLite database with schema and seed data
    db = createTestDb();
    slotDao = createSlotDao(db);
  });

  afterEach(async () => {
    // Close the database connection after each test
    await db.close();
  });

  describe('findById', () => {
    
    it('should return the correct slot and resolved meal type when ID exists', async () => {
      // In the seed data, slot ID 3 corresponds to '2026-11-15' at 12:00 (lunch)
      const slot = await slotDao.findById(3);

      expect(slot).toBeDefined();
      expect(slot).not.toBeNull();
      expect(slot.id).toBe(3);
      expect(slot.hut_id).toBe(1);
      expect(slot.date).toBe('2026-11-15');
      expect(slot.start_time).toBe('12:00');
      expect(slot.status).toBe('available');
      expect(slot.meal).toBe('lunch');
    });

    it('should return null if slot ID does not exist', async () => {
      const slot = await slotDao.findById(9999);
      expect(slot).toBeNull();
    });

  });

  describe('listByDate', () => {
    
    it('should return all slots for a given hut and date ordered by start time', async () => {
      // In the seed data, date '2026-11-15' has multiple slots for hut 1
      const slots = await slotDao.listByDate(1, '2026-11-15');

      expect(slots).toBeInstanceOf(Array);
      expect(slots.length).toBeGreaterThan(0);
      
      // Verify ordering and presence of key fields
      expect(slots[0].date).toBe('2026-11-15');
      expect(slots[0].start_time).toBe('09:00');
      expect(slots[0].meal).toBe('breakfast');
    });

    it('should return an empty array if no slots exist for the given date or hut', async () => {
      const slots = await slotDao.listByDate(1, '2099-01-01');
      expect(slots).toEqual([]);
    });

  });

  describe('getTablesWithFreeForSlot', () => {
    
    it('should return tables associated with the slot and calculate free seats correctly', async () => {
      // In the seed data, slot 3 ('2026-11-15 12:00') has associated tables (e.g., T1, T2, T3, T4, T5)
      const tables = await slotDao.getTablesWithFreeForSlot(3);

      expect(tables).toBeInstanceOf(Array);
      expect(tables.length).toBeGreaterThan(0);

      // Each returned table must have label, seats, and calculated free seats
      const firstTable = tables[0];
      expect(firstTable).toHaveProperty('id');
      expect(firstTable).toHaveProperty('label');
      expect(firstTable).toHaveProperty('seats');
      expect(firstTable).toHaveProperty('free');
      expect(firstTable.free).toBeLessThanOrEqual(firstTable.seats);
    });

    it('should return an empty array for a slot that has no tables assigned (zero capacity)', async () => {
      // In the seed data, slot 8 has hut_id 1 but no rows in slot_tables (issue #17)
      const tables = await slotDao.getTablesWithFreeForSlot(8);
      expect(tables).toEqual([]);
    });

  });

});