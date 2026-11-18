import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBookingCore } from '../../../../src/services/bookingCore.js';
import { NotFoundError, ConflictError } from '../../../../src/errors/AppError.js';

describe('bookingCore - White-Box Tests', () => {
  let bookingDao;
  let slotDao;
  let core;
  const timeZone = 'Europe/Rome';
  const fixedNow = new Date('2026-08-14T07:00:00.000Z');

  beforeEach(() => {
    bookingDao = {
      findById: vi.fn(),
      findConfirmedByHikerAndSlot: vi.fn(),
      create: vi.fn(),
      insertSeats: vi.fn(),
      insertRequirements: vi.fn(),
      deleteSeats: vi.fn(),
      update: vi.fn(),
      cancelIfConfirmed: vi.fn(),
      getSeatAssignments: vi.fn(),
      getRequirements: vi.fn(),
    };

    slotDao = {
      findById: vi.fn(),
      getTablesWithFreeForSlot: vi.fn(),
    };

    core = createBookingCore({
      bookingDao,
      slotDao,
      timeZone,
      now: () => fixedNow,
    });
  });

  describe('loadSlot and loadOpenSlot', () => {
    it('should throw NotFoundError if slot does not exist', async () => {
      slotDao.findById.mockResolvedValue(null);
      await expect(core.loadSlot('tx', 999)).rejects.toThrow(NotFoundError);
    });

    it('should load slot successfully if open', async () => {
      const slot = { id: 101, status: 'available', date: '2026-08-15', start_time: '12:00' };
      slotDao.findById.mockResolvedValue(slot);

      const result = await core.loadOpenSlot('tx', 101);
      expect(result).toEqual(slot);
    });
  });

  describe('loadOwnedBooking and Permissions', () => {
    it('should throw NotFoundError if bookingId is null or undefined', async () => {
      await expect(core.loadOwnedBooking('tx', null, { id: 10 })).rejects.toThrow(NotFoundError);
      await expect(core.loadOwnedBooking('tx', undefined, { id: 10 })).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if booking does not exist in DB', async () => {
      bookingDao.findById.mockResolvedValue(null);
      await expect(core.loadOwnedBooking('tx', 1, { id: 10 })).rejects.toThrow(NotFoundError);
    });

    it('should allow owner to load booking', async () => {
      const booking = { id: 1, hiker_id: 10 };
      bookingDao.findById.mockResolvedValue(booking);

      const result = await core.loadOwnedBooking('tx', 1, { id: 10, role: 'hiker' });
      expect(result).toEqual(booking);
    });

    it('should allow staff to load booking if allowStaff is true', async () => {
      const booking = { id: 1, hiker_id: 99 };
      bookingDao.findById.mockResolvedValue(booking);

      const staffUser = { id: 1, role: 'warden' };
      const result = await core.loadOwnedBooking('tx', 1, staffUser, { allowStaff: true });
      expect(result).toEqual(booking);
    });

    it('should throw NotFoundError if non-owner and non-staff try to load booking', async () => {
      const booking = { id: 1, hiker_id: 99 };
      bookingDao.findById.mockResolvedValue(booking);

      await expect(
        core.loadOwnedBooking('tx', 1, { id: 10, role: 'hiker' }, { allowStaff: true })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('assertConfirmed and assertNoDuplicate', () => {
    it('should throw ConflictError if booking status is not confirmed', () => {
      expect(() => core.assertConfirmed({ status: 'cancelled' })).toThrow(ConflictError);
    });

    it('should throw ConflictError if duplicate confirmed booking exists for same hiker and slot', async () => {
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue({ id: 50 });

      await expect(
        core.assertNoDuplicate('tx', 10, 101)
      ).rejects.toThrow(ConflictError);
    });

    it('should ignore duplicate check if existing booking matches exceptBookingId', async () => {
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue({ id: 50 });

      // Non deve lanciare errore perché l'ID coincide con quello escluso (es. in fase di update)
      await expect(
        core.assertNoDuplicate('tx', 10, 101, { exceptBookingId: 50 })
      ).resolves.toBeUndefined();
    });
  });

  describe('cancel and loadBookingView', () => {
    it('should call cancelIfConfirmed on bookingDao', async () => {
      bookingDao.cancelIfConfirmed.mockResolvedValue(true);
      const result = await core.cancel('tx', { id: 1 });

      expect(result).toBe(true);
      expect(bookingDao.cancelIfConfirmed).toHaveBeenCalledWith('tx', 1);
    });

    it('should load booking view combining booking, assignments and requirements', async () => {
      bookingDao.findById.mockResolvedValue({
        id: 1,
        status: 'confirmed',
        slot_id: 100,
        slot_date: '2026-08-14',
        slot_start_time: '12:00',
        party_size: 2,
      });
      bookingDao.getSeatAssignments.mockResolvedValue([{ tableId: 1, tableLabel: 'T1', seats: 2 }]);
      bookingDao.getRequirements.mockResolvedValue([]);

      const { booking, view } = await core.loadBookingView('tx', 1);

      expect(booking.id).toBe(1);
      expect(view.id).toBe(1);
      expect(view.seatAssignments).toHaveLength(1);
    });
  });

});