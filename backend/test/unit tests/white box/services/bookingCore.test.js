import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBookingCore } from '../../../../src/services/bookingCore.js';
import { NotFoundError, ConflictError, UnprocessableEntityError } from '../../../../src/errors/AppError.js';

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
      expect(slotDao.findById).toHaveBeenCalledWith('tx', 101);
    });

    it('should reject closed or too-late slots and respect leadMs: 0', async () => {
      slotDao.findById.mockResolvedValueOnce({
        id: 102,
        status: 'off',
        date: '2026-08-15',
        start_time: '12:00',
      });
      await expect(core.loadOpenSlot('tx', 102)).rejects.toThrow(ConflictError);

      slotDao.findById.mockResolvedValueOnce({
        id: 103,
        status: 'available',
        date: '2026-08-14',
        start_time: '08:00',
      });
      await expect(core.loadOpenSlot('tx', 103)).rejects.toThrow(UnprocessableEntityError);

      const sameDayOpenSlot = {
        id: 104,
        status: 'available',
        date: '2026-08-14',
        start_time: '11:00',
      };
      slotDao.findById.mockResolvedValueOnce(sameDayOpenSlot);
      await expect(core.loadOpenSlot('tx', 104, { leadMs: 0 })).resolves.toEqual(sameDayOpenSlot);
    });
  });

  describe('assertChangeAllowed', () => {
    it('should pass when slot start is more than 48 hours away', () => {
      expect(() =>
        core.assertChangeAllowed({ date: '2026-08-17', start_time: '12:00', status: 'available' })
      ).not.toThrow();
    });

    it('should throw TOO_LATE_TO_MODIFY within 48 hours of slot start', () => {
      try {
        core.assertChangeAllowed({ date: '2026-08-15', start_time: '12:00', status: 'available' });
        expect.fail('Should have thrown ConflictError');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError);
        expect(err.code).toBe('TOO_LATE_TO_MODIFY');
      }
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

    it('should reject staff when allowStaff is false or omitted', async () => {
      const booking = { id: 1, hiker_id: 99 };
      bookingDao.findById.mockResolvedValue(booking);

      await expect(core.loadOwnedBooking('tx', 1, { id: 1, role: 'employee' })).rejects.toThrow(
        NotFoundError
      );
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
    it('should allow confirmed bookings and throw ConflictError if status is not confirmed', () => {
      expect(() => core.assertConfirmed({ status: 'confirmed' })).not.toThrow();
      expect(() => core.assertConfirmed({ status: 'cancelled' })).toThrow(ConflictError);
    });

    it('should throw ConflictError if duplicate confirmed booking exists for same hiker and slot', async () => {
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue({ id: 50 });

      await expect(core.assertNoDuplicate('tx', 10, 101)).rejects.toThrow(ConflictError);
    });

    it('should ignore duplicate check if existing booking matches exceptBookingId', async () => {
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue({ id: 50 });

      await expect(
        core.assertNoDuplicate('tx', 10, 101, { exceptBookingId: 50 })
      ).resolves.toBeUndefined();
    });
  });

  describe('placeBooking and reseat', () => {
    it('should create booking, seats, and requirements in sequence', async () => {
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 4, free: 4 },
      ]);
      bookingDao.create.mockResolvedValue(77);
      bookingDao.insertSeats.mockResolvedValue();
      bookingDao.insertRequirements.mockResolvedValue();

      const reqs = [{ description: 'Gluten free', allergies: true }];
      const res = await core.placeBooking('tx', {
        slot: { id: 10 },
        hikerId: 5,
        partySize: 2,
        contact: { contactName: 'Luca', email: 'luca@hut.test', phone: '+39123456' },
        requirements: reqs,
      });

      expect(res.bookingId).toBe(77);
      expect(res.assignments).toHaveLength(1);
      expect(bookingDao.create).toHaveBeenCalledWith('tx', {
        slotId: 10,
        hikerId: 5,
        createdBy: null,
        partySize: 2,
        contactName: 'Luca',
        email: 'luca@hut.test',
        phone: '+39123456',
      });
      expect(bookingDao.insertSeats).toHaveBeenCalledWith('tx', 77, res.assignments);
      expect(bookingDao.insertRequirements).toHaveBeenCalledWith('tx', 77, reqs);
    });

    it('should throw INSUFFICIENT_CAPACITY without creating booking when seats are not enough', async () => {
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 2, free: 1 },
      ]);

      await expect(
        core.placeBooking('tx', {
          slot: { id: 10 },
          hikerId: 5,
          partySize: 2,
          contact: {},
          requirements: [],
        })
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_CAPACITY' });

      expect(bookingDao.create).not.toHaveBeenCalled();
    });

    it('should delete old seats, check expectedSeating, and update booking during reseat', async () => {
      slotDao.getTablesWithFreeForSlot.mockResolvedValue([
        { id: 1, label: 'T1', seats: 2, free: 2 },
        { id: 2, label: 'T2', seats: 2, free: 2 },
      ]);
      bookingDao.deleteSeats.mockResolvedValue();
      bookingDao.update.mockResolvedValue();
      bookingDao.insertSeats.mockResolvedValue();

      await expect(
        core.reseat(
          'tx',
          { id: 15, slot_id: 10, party_size: 2 },
          { slot: { id: 11 }, partySize: 4, expectedSeating: 'single_table' }
        )
      ).rejects.toMatchObject({ code: 'SEATING_CHANGED' });

      expect(bookingDao.deleteSeats).toHaveBeenCalledWith('tx', 15);
      expect(bookingDao.update).not.toHaveBeenCalled();

      const assignments = await core.reseat(
        'tx',
        { id: 15, slot_id: 10, party_size: 2 },
        { slot: { id: 11 }, partySize: 4 }
      );

      expect(bookingDao.update).toHaveBeenCalledWith('tx', 15, { slotId: 11, partySize: 4 });
      expect(bookingDao.insertSeats).toHaveBeenCalledWith('tx', 15, assignments);
      expect(assignments).toHaveLength(2);
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

    it('should skip getSeatAssignments when assignments are explicitly passed', async () => {
      bookingDao.findById.mockResolvedValue({
        id: 2,
        status: 'confirmed',
        slot_id: 100,
        slot_date: '2026-08-14',
        slot_start_time: '12:00',
        party_size: 2,
      });
      bookingDao.getRequirements.mockResolvedValue([]);

      const customAssignments = [{ tableId: 3, tableLabel: 'T3', seats: 2 }];
      const { view } = await core.loadBookingView('tx', 2, { assignments: customAssignments });

      expect(view.seatAssignments).toEqual(customAssignments);
      expect(bookingDao.getSeatAssignments).not.toHaveBeenCalled();
    });
  });
});