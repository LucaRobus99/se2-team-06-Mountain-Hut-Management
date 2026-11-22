import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBookingService } from '../../../../src/services/bookingService.js';
import { ValidationError } from '../../../../src/errors/AppError.js';
import { verifyPassword } from '../../../../src/services/password.js';

// MH-07: staff reserve for a hiker (existing account, new account or temporary guest).
describe('bookingService.createStaffBooking - White-Box Tests', () => {
  const timeZone = 'Europe/Rome';
  const fixedNow = new Date('2026-08-14T07:00:00.000Z'); // 09:00 in Rome
  const employee = { id: 2, role: 'employee', displayName: 'Eric Employee', email: 'employee@hut.test' };
  const hikerUser = { id: 3, role: 'hiker', displayName: 'Hanna Hiker' };

  let db;
  let bookingDao;
  let slotDao;
  let userDao;
  let emailService;
  let service;

  const openSlot = { id: 101, date: '2026-08-14', start_time: '14:00', end_time: '16:00', status: 'available' };

  const bookingRow = (overrides = {}) => ({
    id: 500, status: 'confirmed', hiker_id: null, created_by: 2, slot_id: 101,
    slot_date: '2026-08-14', slot_start_time: '14:00', slot_end_time: '16:00', meal: 'lunch',
    party_size: 2, contact_name: 'Walk-in Guest', email: null, phone: '+39 333 111 2222',
    created_at: '2026-08-14T07:00:00.000Z', ...overrides,
  });

  const guestBody = (overrides = {}) => ({
    mode: 'guest', slotId: 101, partySize: 2, contactName: 'Walk-in Guest', contactNumber: '+39 333 111 2222',
    ...overrides,
  });

  const newHikerBody = (overrides = {}) => ({
    mode: 'newHiker', slotId: 101, partySize: 2,
    name: 'Nora New', email: 'Nora@Example.com', phone: '+39 333 444 5555', ...overrides,
  });

  const validationDetails = async (body) => {
    try {
      await service.createStaffBooking(employee, body);
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      return err.details;
    }
    throw new Error('expected a ValidationError');
  };

  beforeEach(() => {
    db = { transaction: vi.fn(async (fn) => fn('tx')) };
    bookingDao = {
      findConfirmedByHikerAndSlot: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(500),
      insertSeats: vi.fn(),
      insertRequirements: vi.fn(),
      findById: vi.fn().mockResolvedValue(bookingRow()),
      getRequirements: vi.fn().mockResolvedValue([]),
    };
    slotDao = {
      findById: vi.fn().mockResolvedValue(openSlot),
      getTablesWithFreeForSlot: vi.fn().mockResolvedValue([{ id: 1, label: 'T1', seats: 4, free: 4 }]),
    };
    userDao = {
      findById: vi.fn(),
      findByEmail: vi.fn().mockResolvedValue(null),
      createHiker: vi.fn(async (_tx, account) => ({ id: 77, ...account })),
    };
    emailService = { sendBookingEmail: vi.fn().mockResolvedValue({ id: 'msg' }) };
    service = createBookingService({
      db, bookingDao, slotDao, userDao, timeZone, now: () => fixedNow, emailService,
    });
  });

  describe('access and slot rules', () => {
    it('refuses hikers (FORBIDDEN) before touching the database', async () => {
      await expect(service.createStaffBooking(hikerUser, guestBody()))
        .rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('accepts a slot that starts within two hours (#35)', async () => {
      slotDao.findById.mockResolvedValue({ ...openSlot, start_time: '10:00' }); // in 1 hour
      await expect(service.createStaffBooking(employee, guestBody())).resolves.toMatchObject({ id: 500 });
    });

    it('refuses a slot that already started', async () => {
      slotDao.findById.mockResolvedValue({ ...openSlot, start_time: '08:30' }); // started 30 minutes ago
      await expect(service.createStaffBooking(employee, guestBody()))
        .rejects.toMatchObject({ code: 'SLOT_ALREADY_STARTED' });
      expect(bookingDao.create).not.toHaveBeenCalled();
    });

    it('refuses when the party does not fit (MH-01 seating)', async () => {
      await expect(service.createStaffBooking(employee, guestBody({ partySize: 9 })))
        .rejects.toMatchObject({ code: 'INSUFFICIENT_CAPACITY' });
    });
  });

  describe('guest (temporary hiker, no account)', () => {
    it.each([
      ['an invalid email', { email: 'invalid-email-format' }, 'email', 'invalid'],
      ['a too long name', { contactName: 'A'.repeat(101) }, 'contactName', 'too_long'],
      ['a non-text phone', { contactNumber: 123456789 }, 'contactNumber', 'invalid'],
      ['a phone with too few digits', { contactNumber: '12-3' }, 'contactNumber', 'invalid'],
      ['a missing name', { contactName: undefined }, 'contactName', 'required'],
      ['a field of another mode', { hikerId: 3 }, 'hikerId', 'unknown'],
    ])('rejects %s', async (_, overrides, field, rule) => {
      expect(await validationDetails(guestBody(overrides)))
        .toEqual(expect.arrayContaining([expect.objectContaining({ field, rule })]));
    });

    it('stores the guest contact on a booking made by the employee, with requirements', async () => {
      const requirements = [{ description: '1 coeliac', allergies: true }];
      const result = await service.createStaffBooking(employee, guestBody({ requirements }));

      expect(bookingDao.create).toHaveBeenCalledWith('tx', expect.objectContaining({
        hikerId: null, createdBy: 2, contactName: 'Walk-in Guest', phone: '+39 333 111 2222', email: null,
      }));
      expect(bookingDao.insertRequirements).toHaveBeenCalledWith('tx', 500, requirements);
      expect(bookingDao.findConfirmedByHikerAndSlot).not.toHaveBeenCalled();
      expect(result).toMatchObject({ mode: 'guest', createdBy: 2, hikerId: null });
      expect(result.initialPassword).toBeUndefined();
    });

    it('never emails the staff member when the guest has no email', async () => {
      const result = await service.createStaffBooking(employee, guestBody());
      // No recipient: the notifier skips before reaching the email service.
      expect(emailService.sendBookingEmail).not.toHaveBeenCalled();
      expect(result.confirmationEmail.status).toBe('skipped');
    });
  });

  describe('existingHiker', () => {
    const body = { mode: 'existingHiker', slotId: 101, partySize: 2, hikerId: 3 };

    it.each([
      ['does not exist', null],
      ['is not a hiker', { id: 3, role: 'employee', name: 'E' }],
    ])('answers HIKER_NOT_FOUND when the account %s', async (_, user) => {
      userDao.findById.mockResolvedValue(user);
      await expect(service.createStaffBooking(employee, body)).rejects.toMatchObject({ code: 'HIKER_NOT_FOUND' });
    });

    it('links the booking to the hiker and copies the contact details from the profile', async () => {
      userDao.findById.mockResolvedValue({ id: 3, role: 'hiker', name: 'Hanna Hiker', email: 'hiker@hut.test', phone: '123456' });
      bookingDao.findById.mockResolvedValue(bookingRow({ hiker_id: 3, contact_name: 'Hanna Hiker', email: 'hiker@hut.test' }));

      const result = await service.createStaffBooking(employee, body);

      expect(bookingDao.create).toHaveBeenCalledWith('tx', expect.objectContaining({
        hikerId: 3, createdBy: 2, contactName: 'Hanna Hiker', email: 'hiker@hut.test', phone: '123456',
      }));
      expect(emailService.sendBookingEmail).toHaveBeenCalledWith('created', 'hiker@hut.test', expect.any(Object));
      expect(result).toMatchObject({ mode: 'existingHiker', hikerId: 3 });
    });

    it('applies the one-booking-per-slot rule to the hiker (#25)', async () => {
      userDao.findById.mockResolvedValue({ id: 3, role: 'hiker', name: 'Hanna', email: 'h@x.it' });
      bookingDao.findConfirmedByHikerAndSlot.mockResolvedValue({ id: 9 });

      await expect(service.createStaffBooking(employee, body)).rejects.toMatchObject({
        code: 'BOOKING_ALREADY_EXISTS',
        message: 'This hiker already has a confirmed booking for this slot.',
      });
      expect(bookingDao.create).not.toHaveBeenCalled();
    });
  });

  describe('newHiker (full account created by staff)', () => {
    it.each([
      ['a missing mobile number', { phone: undefined }, 'phone', 'required'],
      ['an invalid email', { email: 'nope' }, 'email', 'invalid'],
    ])('rejects %s', async (_, overrides, field, rule) => {
      expect(await validationDetails(newHikerBody(overrides)))
        .toEqual(expect.arrayContaining([expect.objectContaining({ field, rule })]));
    });

    it('refuses an email already registered', async () => {
      userDao.findByEmail.mockResolvedValue({ id: 3 });
      await expect(service.createStaffBooking(employee, newHikerBody()))
        .rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
      expect(userDao.createHiker).not.toHaveBeenCalled();
    });

    it('maps a concurrent unique-email violation to EMAIL_ALREADY_REGISTERED', async () => {
      userDao.createHiker.mockRejectedValue(Object.assign(new Error('duplicate key value violates unique constraint "users_email_key"'), { code: '23505', constraint: 'users_email_key' }));
      await expect(service.createStaffBooking(employee, newHikerBody()))
        .rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
    });

    it('creates the account with a hashed, generated password that must be changed, and returns it once', async () => {
      bookingDao.findById.mockResolvedValue(bookingRow({ hiker_id: 77, contact_name: 'Nora New', email: 'nora@example.com' }));

      const result = await service.createStaffBooking(employee, newHikerBody());

      const [, account] = userDao.createHiker.mock.calls[0];
      expect(account).toMatchObject({ name: 'Nora New', email: 'nora@example.com', passwordChangeRequired: 1 });
      expect(account.passwordHash).not.toBe(result.initialPassword);
      expect(verifyPassword(account.passwordHash, result.initialPassword)).toBe(true);

      expect(bookingDao.create).toHaveBeenCalledWith('tx', expect.objectContaining({ hikerId: 77, createdBy: 2 }));
      expect(result).toMatchObject({
        mode: 'newHiker',
        account: { id: 77, email: 'nora@example.com', passwordChangeRequired: true },
      });
      expect(typeof result.initialPassword).toBe('string');

      // #46 option A: the password is never part of the email.
      const [, , fields] = emailService.sendBookingEmail.mock.calls[0];
      expect(JSON.stringify(fields)).not.toContain(result.initialPassword);
    });
  });
});
