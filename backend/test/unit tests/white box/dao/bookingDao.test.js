import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBookingDao } from '../../../../src/dao/bookingDao.js';

describe('bookingDao - White-Box Tests', () => {
  let db;
  let tx;
  let dao;

  beforeEach(() => {
    db = { query: vi.fn() };
    tx = { query: vi.fn() };
    dao = createBookingDao(db);
  });

  describe('create', () => {
    it('should insert a confirmed booking and return the new id', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 7 }] });

      const id = await dao.create({
        slotId: 1,
        hikerId: 2,
        createdBy: 3,
        contactName: 'Mario Rossi',
        email: 'mario@example.com',
        phone: '+39333',
        partySize: 4,
      });

      expect(id).toBe(7);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain("'confirmed'");
      expect(params).toEqual([1, 2, 3, 'Mario Rossi', 'mario@example.com', '+39333', 4]);
    });

    it('should store null for every optional field that is omitted', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 8 }] });

      await dao.create({ slotId: 1, partySize: 2 });

      expect(db.query.mock.calls[0][1]).toEqual([1, null, null, null, null, null, 2]);
    });

    it('should use the transaction executor when one is passed first', async () => {
      tx.query.mockResolvedValue({ rows: [{ id: 9 }] });

      await expect(dao.create(tx, { slotId: 1, partySize: 2 })).resolves.toBe(9);

      expect(tx.query).toHaveBeenCalledTimes(1);
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('insertSeats', () => {
    it('should insert one row per seat assignment', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await dao.insertSeats(5, [
        { tableId: 1, seats: 2 },
        { tableId: 2, seats: 3 },
      ]);

      expect(db.query).toHaveBeenCalledTimes(2);
      expect(db.query.mock.calls[0][1]).toEqual([5, 1, 2]);
      expect(db.query.mock.calls[1][1]).toEqual([5, 2, 3]);
    });

    it('should not touch the database when there are no assignments', async () => {
      await dao.insertSeats(5, []);

      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return the matching booking', async () => {
      const row = { id: 5, slot_id: 1 };
      db.query.mockResolvedValue({ rows: [row] });

      await expect(dao.findById(5)).resolves.toEqual(row);
      expect(db.query.mock.calls[0][1]).toEqual([5]);
    });

    it('should return null when the booking does not exist', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(dao.findById(404)).resolves.toBeNull();
    });
  });

  describe('getSeatAssignments', () => {
    it('should return the rows for the booking', async () => {
      const rows = [{ tableId: 1, tableLabel: 'T1', seats: 2 }];
      db.query.mockResolvedValue({ rows });

      await expect(dao.getSeatAssignments(5)).resolves.toEqual(rows);
      expect(db.query.mock.calls[0][1]).toEqual([5]);
    });
  });

  describe('findConfirmedByHikerAndSlot', () => {
    it('should look up by hiker first, then slot, and only confirmed bookings', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 3 }] });

      await expect(dao.findConfirmedByHikerAndSlot(10, 20)).resolves.toEqual({ id: 3 });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain("status = 'confirmed'");
      expect(params).toEqual([10, 20]);
    });

    it('should return null when the hiker has no confirmed booking', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(dao.findConfirmedByHikerAndSlot(10, 20)).resolves.toBeNull();
    });
  });
});
