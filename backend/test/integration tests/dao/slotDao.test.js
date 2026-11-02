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
    
    it('should return all slots for a given date ordered by start time', async () => {
      // The updated listByDate function takes the date as the first argument
      const slots = await slotDao.listByDate('2026-11-15');

      expect(slots).toBeInstanceOf(Array);
      expect(slots.length).toBeGreaterThan(0);
      
      // Verify ordering and presence of key fields
      expect(slots[0].date).toBe('2026-11-15');
      expect(slots[0].start_time).toBe('09:00');
      expect(slots[0].meal).toBe('breakfast');
    });

    it('should return an empty array if no slots exist for the given date', async () => {
      const slots = await slotDao.listByDate('2099-01-01');
      expect(slots).toEqual([]);
    });

  });

  describe('findMealAt', () => {
    it('should return the correct meal for a time falling within its range', async () => {
      const meal = await slotDao.findMealAt('12:30');
      expect(meal).toBeDefined();
      expect(meal).not.toBeNull();
      expect(meal.meal_type).toBe('lunch');
    });

    it('should return null if no meal matches the given time', async () => {
      const meal = await slotDao.findMealAt('04:00');
      expect(meal).toBeNull();
    });
  });

  describe('getTablesWithFreeForSlot & getTablesWithFreeForSlots', () => {
    
    it('should return tables associated with the slot and calculate free seats correctly', async () => {
      const tables = await slotDao.getTablesWithFreeForSlot(3);

      expect(tables).toBeInstanceOf(Array);
      expect(tables.length).toBeGreaterThan(0);

      const firstTable = tables[0];
      expect(firstTable).toHaveProperty('slot_id');
      expect(firstTable).toHaveProperty('id');
      expect(firstTable).toHaveProperty('label');
      expect(firstTable).toHaveProperty('seats');
      expect(firstTable).toHaveProperty('free');
      expect(firstTable.free).toBeLessThanOrEqual(firstTable.seats);
    });

    it('should return tables for multiple slots at once', async () => {
      const tables = await slotDao.getTablesWithFreeForSlots([3, 4]);
      expect(tables).toBeInstanceOf(Array);
      expect(tables.length).toBeGreaterThan(0);
    });

    it('should return an empty array for a slot that has no tables assigned (zero capacity)', async () => {
      const tables = await slotDao.getTablesWithFreeForSlot(8);
      expect(tables).toEqual([]);
    });

    it('should return an empty array if empty slotIds array is passed to getTablesWithFreeForSlots', async () => {
      const tables = await slotDao.getTablesWithFreeForSlots([]);
      expect(tables).toEqual([]);
    });

  });

  describe('getTableSetForSlot', () => {
    it('should return the table set for a specific slot', async () => {
      const tableSet = await slotDao.getTableSetForSlot(3);
      expect(tableSet).toBeInstanceOf(Array);
      if (tableSet.length > 0) {
        expect(tableSet[0]).toHaveProperty('tableId');
        expect(tableSet[0]).toHaveProperty('seats');
      }
    });
  });

  describe('Slot and Table Creation / Management', () => {
    it('should create a new slot and return its ID', async () => {
      const newSlotId = await slotDao.createSlot({
        date: '2026-12-01',
        startTime: '13:00',
        endTime: '15:00',
        status: 'available'
      });
      expect(newSlotId).toBeDefined();
      expect(typeof newSlotId).toBe('number');
    });

    it('should find a table by label and create a new table', async () => {
      const label = 'TestTable-99';
      let table = await slotDao.findTableByLabel(label);
      expect(table).toBeNull();

      const newTableId = await slotDao.createTable({ label });
      expect(newTableId).toBeDefined();

      table = await slotDao.findTableByLabel(label);
      expect(table).not.toBeNull();
      expect(table.id).toBe(newTableId);
    });

    it('should add a table to a slot', async () => {
      const slotId = await slotDao.createSlot({
        date: '2026-12-02',
        startTime: '10:00',
        endTime: '11:00'
      });
      const tableId = await slotDao.createTable({ label: 'SlotTestTable' });

      // Should not throw
      await expect(slotDao.addTableToSlot(slotId, tableId, 4)).resolves.not.toThrow();

      const tables = await slotDao.getTablesWithFreeForSlot(slotId);
      expect(tables.length).toBe(1);
      expect(tables[0].seats).toBe(4);
    });
  });

});