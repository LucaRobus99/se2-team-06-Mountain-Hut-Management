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

    it('should use the transaction executor in findById when passed first', async () => {
      tx.query.mockResolvedValue({ rows: [{ id: 5 }] });

      await expect(dao.findById(tx, 5)).resolves.toEqual({ id: 5 });
      expect(tx.query).toHaveBeenCalledTimes(1);
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('update & updateStatus & deleteSeats', () => {
    it('should update slot_id and party_size for the specified booking id', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await dao.update(10, { slotId: 4, partySize: 6 });

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('UPDATE bookings SET slot_id = $2, party_size = $3 WHERE id = $1');
      expect(params).toEqual([10, 4, 6]);
    });

    it('should default booking to an empty object when omitted in update', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await dao.update(10);

      expect(db.query.mock.calls[0][1]).toEqual([10, undefined, undefined]);
    });

    it('should update the booking status', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await dao.updateStatus(15, 'cancelled');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('UPDATE bookings SET status = $2 WHERE id = $1');
      expect(params).toEqual([15, 'cancelled']);
    });

    it('should delete all seat assignments for a given booking id', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await dao.deleteSeats(22);

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('DELETE FROM booking_seats WHERE booking_id = $1');
      expect(params).toEqual([22]);
    });
  });

  describe('listByHiker', () => {
    it('should return all bookings for a given hiker ordered by slot date and start time', async () => {
      const mockBookings = [
        { id: 10, slot_id: 2, party_size: 2, status: 'confirmed' },
        { id: 5, slot_id: 1, party_size: 4, status: 'confirmed' },
      ];
      db.query.mockResolvedValue({ rows: mockBookings });

      const result = await dao.listByHiker(99);

      expect(result).toEqual(mockBookings);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('WHERE b.hiker_id = $1');
      expect(sql).toContain('ORDER BY s.date DESC, s.start_time DESC, b.id DESC');
      expect(params).toEqual([99]);
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

  describe('insertRequirements, replaceRequirements & getRequirements', () => {
    it('should correctly insert requirements and map boolean allergies to 0/1', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await dao.insertRequirements(12, [
        { description: 'Vegan', allergies: true },
        { description: 'None', allergies: false },
      ]);

      expect(db.query).toHaveBeenCalledTimes(2);
      expect(db.query.mock.calls[0][1]).toEqual([12, 'Vegan', 1]);
      expect(db.query.mock.calls[1][1]).toEqual([12, 'None', 0]);
    });

    it('should not execute queries when insertRequirements receives an empty array', async () => {
      await dao.insertRequirements(12, []);

      expect(db.query).not.toHaveBeenCalled();
    });

    it('should replace requirements by deleting old ones and inserting new ones in transaction', async () => {
      tx.query.mockResolvedValue({ rows: [] });

      await dao.replaceRequirements(tx, 30, [{ description: 'Lactose free', allergies: true }]);

      expect(tx.query).toHaveBeenCalledTimes(2);
      expect(tx.query.mock.calls[0][0]).toContain('DELETE FROM booking_requirements WHERE booking_id = $1');
      expect(tx.query.mock.calls[0][1]).toEqual([30]);
      expect(tx.query.mock.calls[1][0]).toContain('INSERT INTO booking_requirements');
      expect(tx.query.mock.calls[1][1]).toEqual([30, 'Lactose free', 1]);
    });

    it('should clear requirements when replaceRequirements receives an empty array', async () => {
      tx.query.mockResolvedValue({ rows: [] });

      await dao.replaceRequirements(tx, 30, []);

      expect(tx.query).toHaveBeenCalledTimes(1);
      expect(tx.query.mock.calls[0][0]).toContain('DELETE FROM booking_requirements WHERE booking_id = $1');
      expect(tx.query.mock.calls[0][1]).toEqual([30]);
    });

    it('should fetch requirements successfully with boolean mapping', async () => {
      const mockReqRows = [
        { description: 'Allergy', allergies: 1 },
        { description: 'Preference', allergies: 0 },
      ];
      db.query.mockResolvedValue({ rows: mockReqRows });

      await expect(dao.getRequirements(5)).resolves.toEqual([
        { description: 'Allergy', allergies: true },
        { description: 'Preference', allergies: false },
      ]);
      expect(db.query.mock.calls[0][1]).toEqual([5]);
    });
  });

  describe('getRequirementsByBookingIds', () => {
    it('should return an empty Map without querying DB if bookingIds array is empty', async () => {
      const result = await dao.getRequirementsByBookingIds([]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should group requirements by bookingId and initialize empty arrays for bookings without requirements', async () => {
      db.query.mockResolvedValue({
        rows: [
          { bookingId: 1, description: 'Nuts', allergies: 1 },
        ],
      });

      const result = await dao.getRequirementsByBookingIds([1, 2]);

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(result.get(1)).toEqual([{ description: 'Nuts', allergies: true }]);
      expect(result.get(2)).toEqual([]);
    });

    it('should safely ignore rows whose bookingId is not in the requested ids map', async () => {
      db.query.mockResolvedValue({
        rows: [{ bookingId: 999, description: 'Orphan', allergies: 0 }],
      });

      const result = await dao.getRequirementsByBookingIds([1]);

      expect(result.get(1)).toEqual([]);
      expect(result.has(999)).toBe(false);
    });
  });

  describe('cancelIfConfirmed', () => {
    it('should return true when exactly one row is updated from confirmed to cancelled', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const success = await dao.cancelIfConfirmed(12);

      expect(success).toBe(true);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain("UPDATE bookings SET status = 'cancelled'");
      expect(sql).toContain("status = 'confirmed'");
      expect(params).toEqual([12]);
    });

    it('should return false when no rows are updated (e.g., already cancelled)', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      const success = await dao.cancelIfConfirmed(12);

      expect(success).toBe(false);
    });
  });
});