import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toBookingResponse,
  runInTransaction,
  createBookingCore,
} from '../../../../src/services/bookingCore.js';
import { AppError, ConflictError, NotFoundError } from '../../../../src/errors/AppError.js';

describe('bookingCore - Black-Box Tests', () => {
  describe('toBookingResponse (API formatting)', () => {
    it('should correctly format a standard single-table booking response', () => {
      const mockBooking = {
        id: 1,
        status: 'confirmed',
        hiker_id: 10,
        created_by: null,
        slot_id: 100,
        slot_date: '2026-08-14',
        slot_start_time: '12:00',
        slot_end_time: '14:00',
        meal: 'lunch',
        party_size: 2,
        contact_name: 'Mario Rossi',
        email: 'mario@example.com',
        phone: '+393331234567',
        created_at: '2026-08-10T10:00:00.000Z',
      };
      const assignments = [{ tableId: 1, tableLabel: 'T1', seats: 2 }];
      const requirements = [{ description: 'Vegetarian', allergies: false }];

      const response = toBookingResponse(mockBooking, assignments, requirements);

      expect(response).toEqual({
        id: 1,
        status: 'confirmed',
        hikerId: 10,
        createdBy: null,
        slot: {
          id: 100,
          date: '2026-08-14',
          startTime: '12:00',
          endTime: '14:00',
          meal: 'lunch',
        },
        partySize: 2,
        contactName: 'Mario Rossi',
        email: 'mario@example.com',
        contactNumber: '+393331234567',
        requirements,
        split: false,
        seatAssignments: [{ tableId: 1, tableLabel: 'T1', seats: 2 }],
        createdAt: '2026-08-10T10:00:00.000Z',
      });
      expect(response.notice).toBeUndefined();
    });

    it('should include split notice when assignments span multiple tables', () => {
      const mockBooking = {
        id: 2,
        status: 'confirmed',
        party_size: 4,
        slot_id: 100,
        slot_date: '2026-08-14',
        slot_start_time: '12:00',
      };
      const assignments = [
        { tableId: 1, tableLabel: 'T1', seats: 2 },
        { tableId: 2, tableLabel: 'T2', seats: 2 },
      ];

      const response = toBookingResponse(mockBooking, assignments, []);

      expect(response.split).toBe(true);
      expect(response.notice).toEqual({
        code: 'GROUP_SPLIT',
        message: 'The group will be seated across multiple tables.',
      });
    });
  });

  describe('runInTransaction', () => {
    it('should return the result of transaction callback if successful', async () => {
      const db = { transaction: vi.fn(async (cb) => cb('tx-mock')) };
      const result = await runInTransaction(db, async () => 'success');

      expect(result).toBe('success');
      expect(db.transaction).toHaveBeenCalledTimes(1);
    });

    it('should pass through AppError instances without modification', async () => {
      const db = {
        transaction: vi.fn(async () => {
          throw new ConflictError('Custom conflict', 'CONFLICT_CODE');
        }),
      };

      await expect(runInTransaction(db, async () => {})).rejects.toThrow(ConflictError);
    });

    it('should wrap non-AppError exceptions into a generic 500 AppError', async () => {
      const db = {
        transaction: vi.fn(async () => {
          throw new Error('Database crash');
        }),
      };

      try {
        await runInTransaction(db, async () => {});
        expect.fail('Should have thrown AppError');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.status).toBe(500);
        expect(err.code).toBe('INTERNAL_ERROR');
      }
    });
  });

  describe('createBookingCore operations', () => {
    let tx;
    let bookingDao;
    let slotDao;
    let core;

    beforeEach(() => {
      tx = { name: 'tx' };
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
        timeZone: 'Europe/Rome',
        now: () => new Date('2026-08-10T10:00:00.000Z'),
      });
    });

    describe('loadSlot & loadOpenSlot', () => {
      it('should throw SLOT_NOT_FOUND when slot does not exist', async () => {
        slotDao.findById.mockResolvedValue(null);

        await expect(core.loadSlot(tx, 99)).rejects.toMatchObject({
          status: 404,
          code: 'SLOT_NOT_FOUND',
        });
      });

      it('should return an open future slot in loadOpenSlot', async () => {
        const openSlot = {
          id: 10,
          date: '2026-08-15',
          start_time: '12:00',
          end_time: '14:00',
          status: 'available',
        };
        slotDao.findById.mockResolvedValue(openSlot);

        await expect(core.loadOpenSlot(tx, 10)).resolves.toEqual(openSlot);
      });

      it('should reject a closed slot in loadOpenSlot', async () => {
        slotDao.findById.mockResolvedValue({
          id: 10,
          date: '2026-08-15',
          start_time: '12:00',
          end_time: '14:00',
          status: 'off',
        });

        await expect(core.loadOpenSlot(tx, 10)).rejects.toThrow();
      });

      it('should allow booking up to slot start when leadMs is 0', async () => {
        const sameDaySlot = {
          id: 11,
          date: '2026-08-10',
          start_time: '13:00',
          end_time: '15:00',
          status: 'available',
        };
        slotDao.findById.mockResolvedValue(sameDaySlot);

        await expect(core.loadOpenSlot(tx, 11, { leadMs: 0 })).resolves.toEqual(sameDaySlot);
      });
    });

    describe('assertChangeAllowed', () => {
      it('should allow changes well before the 48-hour cutoff', () => {
        expect(() =>
          core.assertChangeAllowed({
            date: '2026-08-15',
            start_time: '12:00',
            end_time: '14:00',
            status: 'available',
          })
        ).not.toThrow();
      });

      it('should throw TOO_LATE_TO_MODIFY within 48 hours of slot start', () => {
        expect(() =>
          core.assertChangeAllowed({
            date: '2026-08-11',
            start_time: '12:00',
            end_time: '14:00',
            status: 'available',
          })
        ).toThrowError(ConflictError);

        try {
          core.assertChangeAllowed({
            date: '2026-08-11',
            start_time: '12:00',
            end_time: '14:00',
            status: 'available',
          });
        } catch (err) {
          expect(err.code).toBe('TOO_LATE_TO_MODIFY');
        }
      });
    });

    describe('loadOwnedBooking', () => {
      it('should throw BOOKING_NOT_FOUND for missing id or unknown booking', async () => {
        await expect(core.loadOwnedBooking(tx, null, { id: 3, role: 'hiker' })).rejects.toThrow(
          NotFoundError
        );

        bookingDao.findById.mockResolvedValue(null);
        await expect(core.loadOwnedBooking(tx, 50, { id: 3, role: 'hiker' })).rejects.toMatchObject({
          code: 'BOOKING_NOT_FOUND',
        });
      });

      it('should return booking to its owner and hide it from other hikers', async () => {
        const booking = { id: 50, hiker_id: 3, status: 'confirmed' };
        bookingDao.findById.mockResolvedValue(booking);

        await expect(core.loadOwnedBooking(tx, 50, { id: 3, role: 'hiker' })).resolves.toEqual(
          booking
        );

        await expect(core.loadOwnedBooking(tx, 50, { id: 4, role: 'hiker' })).rejects.toMatchObject({
          code: 'BOOKING_NOT_FOUND',
        });
      });

      it('should allow staff only when allowStaff is true', async () => {
        const booking = { id: 50, hiker_id: 3, status: 'confirmed' };
        bookingDao.findById.mockResolvedValue(booking);

        await expect(
          core.loadOwnedBooking(tx, 50, { id: 1, role: 'employee' })
        ).rejects.toMatchObject({ code: 'BOOKING_NOT_FOUND' });

        await expect(
          core.loadOwnedBooking(tx, 50, { id: 1, role: 'employee' }, { allowStaff: true })
        ).resolves.toEqual(booking);
      });
    });

    describe('assertConfirmed & assertNoDuplicate', () => {
      it('should reject non-confirmed bookings with BOOKING_NOT_CONFIRMED', () => {
        expect(() => core.assertConfirmed({ status: 'confirmed' })).not.toThrow();
        expect(() => core.assertConfirmed({ status: 'cancelled' })).toThrowError(ConflictError);

        try {
          core.assertConfirmed({ status: 'cancelled' }, 'Cannot modify cancelled booking.');
        } catch (err) {
          expect(err.code).toBe('BOOKING_NOT_CONFIRMED');
          expect(err.message).toBe('Cannot modify cancelled booking.');
        }
      });

      it('should reject duplicate confirmed bookings unless matching exceptBookingId', async () => {
        bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue({ id: 77 });

        await expect(core.assertNoDuplicate(tx, 3, 10)).rejects.toMatchObject({
          code: 'BOOKING_ALREADY_EXISTS',
        });

        await expect(
          core.assertNoDuplicate(tx, 3, 10, { exceptBookingId: 77 })
        ).resolves.toBeUndefined();
      });
    });

    describe('placeBooking & reseat', () => {
      it('should create booking, seat assignments, and requirements when capacity is available', async () => {
        slotDao.getTablesWithFreeForSlot.mockResolvedValue([
          { id: 1, label: 'T1', seats: 4, free: 4 },
        ]);
        bookingDao.create.mockResolvedValue(12);
        bookingDao.insertSeats.mockResolvedValue();
        bookingDao.insertRequirements.mockResolvedValue();

        const result = await core.placeBooking(tx, {
          slot: { id: 5 },
          hikerId: 3,
          partySize: 2,
          contact: { contactName: 'Hanna', email: 'hanna@hut.test', phone: '123' },
          requirements: [{ description: 'Vegan', allergies: false }],
        });

        expect(result.bookingId).toBe(12);
        expect(result.assignments).toHaveLength(1);
        expect(result.assignments[0]).toMatchObject({ tableId: 1, seats: 2 });
        expect(bookingDao.create).toHaveBeenCalledTimes(1);
        expect(bookingDao.insertSeats).toHaveBeenCalledTimes(1);
        expect(bookingDao.insertRequirements).toHaveBeenCalledTimes(1);
      });

      it('should fail when partySize exceeds available seats', async () => {
        slotDao.getTablesWithFreeForSlot.mockResolvedValue([
          { id: 1, label: 'T1', seats: 2, free: 2 },
        ]);

        await expect(
          core.placeBooking(tx, {
            slot: { id: 5 },
            hikerId: 3,
            partySize: 5,
            contact: { contactName: 'Hanna' },
            requirements: [],
          })
        ).rejects.toThrow();

        expect(bookingDao.create).not.toHaveBeenCalled();
      });

      it('should reseat booking when capacity allows and reject split if expectedSeating is single_table', async () => {
        slotDao.getTablesWithFreeForSlot.mockResolvedValue([
          { id: 1, label: 'T1', seats: 2, free: 2 },
          { id: 2, label: 'T2', seats: 2, free: 2 },
        ]);
        bookingDao.deleteSeats.mockResolvedValue();
        bookingDao.update.mockResolvedValue();
        bookingDao.insertSeats.mockResolvedValue();

        await expect(
          core.reseat(
            tx,
            { id: 20, slot_id: 5, party_size: 2 },
            { slot: { id: 6 }, partySize: 4, expectedSeating: 'single_table' }
          )
        ).rejects.toMatchObject({ code: 'SEATING_CHANGED' });

        const newAssignments = await core.reseat(
          tx,
          { id: 20, slot_id: 5, party_size: 2 },
          { slot: { id: 6 }, partySize: 4 }
        );

        expect(newAssignments).toHaveLength(2);
        expect(newAssignments).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ tableId: 1, seats: 2 }),
            expect.objectContaining({ tableId: 2, seats: 2 }),
          ])
        );
      });
    });

    describe('cancel & loadBookingView', () => {
      it('should delegate cancellation to bookingDao.cancelIfConfirmed', async () => {
        bookingDao.cancelIfConfirmed.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

        await expect(core.cancel(tx, { id: 30 })).resolves.toBe(true);
        await expect(core.cancel(tx, { id: 30 })).resolves.toBe(false);
      });

      it('should build booking view using provided assignments or fetching them', async () => {
        const bookingRow = {
          id: 40,
          status: 'confirmed',
          hiker_id: 3,
          created_by: null,
          slot_id: 8,
          slot_date: '2026-08-20',
          slot_start_time: '18:00',
          slot_end_time: '20:00',
          meal: 'dinner',
          party_size: 2,
          contact_name: 'Hanna',
          email: 'hanna@hut.test',
          phone: null,
          created_at: '2026-08-10T10:00:00.000Z',
        };
        bookingDao.findById.mockResolvedValue(bookingRow);
        bookingDao.getRequirements.mockResolvedValue([]);
        bookingDao.getSeatAssignments.mockResolvedValue([
          { tableId: 1, tableLabel: 'T1', seats: 2 },
        ]);

        const providedView = await core.loadBookingView(tx, 40, {
          assignments: [{ tableId: 2, tableLabel: 'T2', seats: 2 }],
        });
        expect(providedView.view.seatAssignments).toEqual([
          { tableId: 2, tableLabel: 'T2', seats: 2 },
        ]);
        expect(bookingDao.getSeatAssignments).not.toHaveBeenCalled();

        const loadedView = await core.loadBookingView(tx, 40);
        expect(loadedView.view.seatAssignments).toEqual([
          { tableId: 1, tableLabel: 'T1', seats: 2 },
        ]);
      });
    });
  });
});