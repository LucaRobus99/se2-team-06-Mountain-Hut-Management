import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../helpers/dbHelper.js';
import { createSlotDao } from '../../../src/dao/slotDao.js';

describe('SlotDao - Integration Tests', () => {
  let db;
  let slotDao;

  beforeEach(() => {
    db = createTestDb();
    slotDao = createSlotDao(db);
  });

  afterEach(async () => {
    await db.close();
  });

  describe('findById', () => {
    it('should return the correct slot and resolved meal type when ID exists', async () => {
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
      const slots = await slotDao.listByDate('2026-11-15');

      expect(slots).toBeInstanceOf(Array);
      expect(slots.length).toBeGreaterThan(0);

      expect(slots[0].date).toBe('2026-11-15');
      expect(slots[0].start_time).toBe('09:00');
      expect(slots[0].meal).toBe('breakfast');
    });

    it('should return an empty array if no slots exist for the given date', async () => {
      const slots = await slotDao.listByDate('2099-01-01');
      expect(slots).toEqual([]);
    });
  });

  describe('findMealByType', () => {
    it('should return the correct meal record when a valid meal type exists', async () => {
      const meal = await slotDao.findMealByType('lunch');
      expect(meal).toBeDefined();
      expect(meal).not.toBeNull();
      expect(meal.meal_type).toBe('lunch');
      expect(meal).toHaveProperty('id');
    });

    it('should return null if no meal matches the given type', async () => {
      const meal = await slotDao.findMealByType('brunch');
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

    it('should support excluding a specific booking ID via exceptBookingId', async () => {
      const withoutExclusion = await slotDao.getTablesWithFreeForSlots([3]);
      const withExclusion = await slotDao.getTablesWithFreeForSlots([3], 999999);

      expect(withExclusion).toEqual(withoutExclusion);
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

  describe('getTableSetForSlot & getTableSetForSlots', () => {
    it('should return the table set for a specific slot', async () => {
      const tableSet = await slotDao.getTableSetForSlot(3);
      expect(tableSet).toBeInstanceOf(Array);
      if (tableSet.length > 0) {
        expect(tableSet[0]).toHaveProperty('tableId');
        expect(tableSet[0]).toHaveProperty('seats');
      }
    });

    it('should return a Map of table sets keyed by slot ID for multiple slots', async () => {
      const map = await slotDao.getTableSetForSlots([3, 8]);
      expect(map).toBeInstanceOf(Map);
      expect(map.has(3)).toBe(true);
      expect(map.has(8)).toBe(true);
      expect(Array.isArray(map.get(3))).toBe(true);
      expect(map.get(8)).toEqual([]);
    });
  });

  describe('Slot and Table Creation / Management', () => {
    it('should create a new slot and return its ID', async () => {
      const meal = await slotDao.findMealByType('lunch');

      const newSlotId = await slotDao.createSlot({
        date: '2026-12-01',
        startTime: '13:00',
        endTime: '15:00',
        mealId: meal.id,
        status: 'available',
      });
      expect(newSlotId).toBeDefined();
      expect(typeof newSlotId).toBe('number');
    });

    it('should find a table by label, create a new table, list it, and delete it', async () => {
      const label = 'TestTable-99';
      let table = await slotDao.findTableByLabel(label);
      expect(table).toBeNull();

      const newTableId = await slotDao.createTable({ label, seats: 4 });
      expect(newTableId).toBeDefined();

      table = await slotDao.findTableByLabel(label);
      expect(table).not.toBeNull();
      expect(table.id).toBe(newTableId);

      const allTables = await slotDao.listTables();
      expect(allTables.some((t) => t.id === newTableId && t.label === label)).toBe(true);

      const deleted = await slotDao.deleteTable(newTableId);
      expect(deleted).toBe(true);

      const deletedAgain = await slotDao.deleteTable(newTableId);
      expect(deletedAgain).toBe(false);
    });

    it('should add a table to a slot', async () => {
      const meal = await slotDao.findMealByType('lunch');

      const slotId = await slotDao.createSlot({
        date: '2026-12-02',
        startTime: '10:00',
        endTime: '11:00',
        mealId: meal.id,
      });
      const tableId = await slotDao.createTable({ label: 'SlotTestTable', seats: 4 });

      await expect(slotDao.addTableToSlot(slotId, tableId, 4)).resolves.not.toThrow();

      const tables = await slotDao.getTablesWithFreeForSlot(slotId);
      expect(tables.length).toBe(1);
      expect(tables[0].seats).toBe(4);
    });
  });

  describe('listByDateRange, listTimePatterns, hasAnyConfirmedBookingInRange & clearSlotsByDateRange', () => {
    it('should list active slots within a date range and return distinct time patterns', async () => {
      const rangeSlots = await slotDao.listByDateRange('2026-11-15', '2026-11-15');
      expect(Array.isArray(rangeSlots)).toBe(true);
      expect(rangeSlots.length).toBeGreaterThan(0);

      const patterns = await slotDao.listTimePatterns();
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]).toHaveProperty('startTime');
      expect(patterns[0]).toHaveProperty('endTime');
      expect(patterns[0]).toHaveProperty('meal');
    });

    it('should check whether any confirmed booking exists in a date range', async () => {
      const farFutureHasConfirmed = await slotDao.hasAnyConfirmedBookingInRange('2099-01-01', '2099-01-07');
      expect(farFutureHasConfirmed).toBe(false);
    });

    it('should clear active slots without bookings in a date range', async () => {
      const meal = await slotDao.findMealByType('dinner');
      await slotDao.createSlot({
        date: '2026-12-10',
        startTime: '18:00',
        endTime: '19:00',
        mealId: meal.id,
        status: 'available',
      });

      const before = await slotDao.listByDateRange('2026-12-10', '2026-12-10');
      expect(before.length).toBe(1);

      await slotDao.clearSlotsByDateRange('2026-12-10', '2026-12-10');

      const after = await slotDao.listByDateRange('2026-12-10', '2026-12-10');
      expect(after).toEqual([]);
    });
  });
});