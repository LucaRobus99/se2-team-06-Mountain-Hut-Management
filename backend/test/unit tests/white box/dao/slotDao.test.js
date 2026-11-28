import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSlotDao } from '../../../../src/dao/slotDao.js';

describe('slotDao - White-Box Tests', () => {
  let db;
  let tx;
  let dao;

  beforeEach(() => {
    db = { query: vi.fn() };
    tx = { query: vi.fn() };
    dao = createSlotDao(db);
  });

  describe('findById', () => {
    it('should return the slot when it exists', async () => {
      const slot = { id: 1, date: '2026-08-14' };
      db.query.mockResolvedValue({ rows: [slot] });

      await expect(dao.findById(1)).resolves.toEqual(slot);
      expect(db.query.mock.calls[0][1]).toEqual([1]);
    });

    it('should return null when the slot does not exist', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(dao.findById(404)).resolves.toBeNull();
    });
  });

  describe('listByDate', () => {
    it('should return the slots of the date ordered by start time', async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      db.query.mockResolvedValue({ rows });

      await expect(dao.listByDate('2026-08-14')).resolves.toEqual(rows);

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('ORDER BY s.start_time, s.id');
      expect(params).toEqual(['2026-08-14']);
    });

    it('should use the transaction executor when one is passed first', async () => {
      tx.query.mockResolvedValue({ rows: [] });

      await dao.listByDate(tx, '2026-08-14');

      expect(tx.query.mock.calls[0][1]).toEqual(['2026-08-14']);
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('findMealByType', () => {
    it('should return the meal when the type exists', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 2, meal_type: 'lunch' }] });

      await expect(dao.findMealByType('lunch')).resolves.toEqual({ id: 2, meal_type: 'lunch' });
    });

    it('should return null for an unknown meal type', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(dao.findMealByType('brunch')).resolves.toBeNull();
    });
  });

  describe('tables with free seats', () => {
    it('should query a single slot with one placeholder', async () => {
      const rows = [{ slot_id: 1, id: 1, label: 'T1', seats: 4, free: 2 }];
      db.query.mockResolvedValue({ rows });

      await expect(dao.getTablesWithFreeForSlot(1)).resolves.toEqual(rows);

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('IN ($1)');
      expect(sql).not.toContain('AND b.id <>');
      expect(params).toEqual([1]);
    });

    it('should build one placeholder per slot for a multi-slot lookup', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await dao.getTablesWithFreeForSlots([1, 2, 3]);

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('IN ($1, $2, $3)');
      expect(params).toEqual([1, 2, 3]);
    });

    it('should append booking exclusion clause when exceptBookingId is provided', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await dao.getTablesWithFreeForSlots([1, 2], 77);

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('IN ($1, $2)');
      expect(sql).toContain('AND b.id <> $3');
      expect(params).toEqual([1, 2, 77]);
    });

    it('should skip the query when there are no slots', async () => {
      await expect(dao.getTablesWithFreeForSlots([])).resolves.toEqual([]);

      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('getTableSetForSlot & getTableSetForSlots', () => {
    it('should return the table set of the slot', async () => {
      const rows = [{ tableId: 1, seats: 4 }];
      db.query.mockResolvedValue({ rows });

      await expect(dao.getTableSetForSlot(1)).resolves.toEqual(rows);
      expect(db.query.mock.calls[0][1]).toEqual([1]);
    });

    it('should group table rows into a Map by slot_id and default missing slots to []', async () => {
      db.query.mockResolvedValue({
        rows: [
          { slot_id: 10, table_id: 1, seats: 4 },
          { slot_id: 10, table_id: 2, seats: 2 },
        ],
      });

      const map = await dao.getTableSetForSlots([10, 20]);
      expect(map.get(10)).toEqual([
        { tableId: 1, seats: 4 },
        { tableId: 2, seats: 2 },
      ]);
      expect(map.get(20)).toEqual([]);
      expect(db.query.mock.calls[0][1]).toEqual([[10, 20]]);
    });
  });

  describe('createSlot', () => {
    const slot = { date: '2026-08-14', startTime: '12:00', endTime: '13:00', mealId: 2 };

    it('should default the status to available and return the new id', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 11 }] });

      await expect(dao.createSlot(slot)).resolves.toBe(11);

      expect(db.query.mock.calls[0][1]).toEqual(['2026-08-14', '12:00', '13:00', 2, 'available']);
    });

    it('should keep an explicit status', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 12 }] });

      await dao.createSlot({ ...slot, status: 'closed' });

      expect(db.query.mock.calls[0][1][4]).toBe('closed');
    });
  });

  describe('addTableToSlot', () => {
    it('should insert the seats the table has in this slot', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await dao.addTableToSlot(1, 2, 6);

      expect(db.query.mock.calls[0][1]).toEqual([1, 2, 6]);
    });
  });

  describe('findTableByLabel, createTable, deleteTable & listTables', () => {
    it('should return the table when the label exists', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 3 }] });

      await expect(dao.findTableByLabel('T1')).resolves.toEqual({ id: 3 });
      expect(db.query.mock.calls[0][1]).toEqual(['T1']);
    });

    it('should return null when the label does not exist', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(dao.findTableByLabel('T99')).resolves.toBeNull();
    });

    it('should insert the label and return the new id', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 4 }] });

      await expect(dao.createTable({ label: 'T4', seats: 6 })).resolves.toBe(4);
      expect(db.query.mock.calls[0][1]).toEqual(['T4', 6]);
    });

    it('should return true when deleteTable deletes a row and false when none matched', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 4 }] });
      await expect(dao.deleteTable(4)).resolves.toBe(true);

      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(dao.deleteTable(4)).resolves.toBe(false);
    });

    it('should list all tables ordered by label and id', async () => {
      const rows = [{ id: 1, label: 'T1', seats: 4 }];
      db.query.mockResolvedValue({ rows });

      await expect(dao.listTables()).resolves.toEqual(rows);
      expect(db.query.mock.calls[0][0]).toContain('ORDER BY label, id');
    });
  });

  describe('range queries, time patterns, booking checks & range clear', () => {
    it('should list active slots in a date range', async () => {
      const rows = [{ id: 1, date: '2026-08-17' }];
      db.query.mockResolvedValue({ rows });

      await expect(dao.listByDateRange('2026-08-17', '2026-08-23')).resolves.toEqual(rows);
      expect(db.query.mock.calls[0][1]).toEqual(['2026-08-17', '2026-08-23']);
    });

    it('should list distinct time patterns', async () => {
      const rows = [{ startTime: '12:00', endTime: '13:00', meal: 'lunch' }];
      db.query.mockResolvedValue({ rows });

      await expect(dao.listTimePatterns()).resolves.toEqual(rows);
      expect(db.query.mock.calls[0][0]).toContain('SELECT DISTINCT');
    });

    it('should return true or false based on rowCount in hasAnyConfirmedBookingInRange', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      await expect(dao.hasAnyConfirmedBookingInRange('2026-08-17', '2026-08-23')).resolves.toBe(true);

      db.query.mockResolvedValueOnce({ rowCount: 0 });
      await expect(dao.hasAnyConfirmedBookingInRange('2026-08-17', '2026-08-23')).resolves.toBe(false);
    });

    it('should archive slots with bookings and delete remaining slots in clearSlotsByDateRange', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await dao.clearSlotsByDateRange(tx, '2026-08-17', '2026-08-23');

      expect(tx.query).toHaveBeenCalledTimes(2);
      expect(tx.query.mock.calls[0][0]).toContain('UPDATE slots s');
      expect(tx.query.mock.calls[0][1]).toEqual(['2026-08-17', '2026-08-23']);
      expect(tx.query.mock.calls[1][0]).toContain('DELETE FROM slots');
      expect(tx.query.mock.calls[1][1]).toEqual(['2026-08-17', '2026-08-23']);
    });
  });
});