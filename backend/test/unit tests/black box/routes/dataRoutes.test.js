import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAvailabilityRouter } from '../../../../src/routes/availabilityRoutes.js';
import { createBookingRouter } from '../../../../src/routes/bookingRoutes.js';
import { createSlotRouter } from '../../../../src/routes/slotRoutes.js';
import { errorHandler } from '../../../../src/middleware/errorHandler.js';
import { ROLES, STAFF_ROLES, STAFF_ONLY_MESSAGE } from '../../../../src/auth/roles.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../../src/errors/AppError.js';

const user = { id: 1, role: 'employee' };

/** Stands in for the real middleware: records the roles and signs in `user`. */
function fakeRequireAuth() {
  return vi.fn(() => (req, _res, next) => {
    req.user = user;
    next();
  });
}

function appWith(path, router) {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  app.use(errorHandler);
  return app;
}

describe('availabilityRoutes - Black-Box Tests', () => {
  let slotService;
  let app;

  beforeEach(() => {
    slotService = { listAvailableSlots: vi.fn(), getSeating: vi.fn() };
    app = appWith('/api/availability', createAvailabilityRouter(slotService));
  });

  it('should pass the query to the service and return its result', async () => {
    slotService.listAvailableSlots.mockResolvedValue({ slots: [] });

    const res = await request(app).get('/api/availability?date=2026-08-14&meal=lunch&partySize=2');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ slots: [] });
    expect(slotService.listAvailableSlots).toHaveBeenCalledWith({ date: '2026-08-14', meal: 'lunch', partySize: '2' });
  });

  it('should answer 400 when the availability query is invalid', async () => {
    slotService.listAvailableSlots.mockRejectedValue(new ValidationError('bad', 'VALIDATION_ERROR', []));

    const res = await request(app).get('/api/availability');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should pass the slot id and query to the seating lookup', async () => {
    slotService.getSeating.mockResolvedValue({ fit: 'single_table' });

    const res = await request(app).get('/api/availability/5/seating?partySize=3');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ fit: 'single_table' });
    expect(slotService.getSeating).toHaveBeenCalledWith('5', { partySize: '3' });
  });

  it('should answer 404 when the seating slot does not exist', async () => {
    slotService.getSeating.mockRejectedValue(new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND'));

    const res = await request(app).get('/api/availability/999/seating?partySize=3');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SLOT_NOT_FOUND');
  });
});

describe('bookingRoutes - Black-Box Tests', () => {
  let bookingService;
  let requireAuth;
  let app;

  beforeEach(() => {
    bookingService = { createBooking: vi.fn(), getBooking: vi.fn() };
    requireAuth = fakeRequireAuth();
    app = appWith('/api/bookings', createBookingRouter(bookingService, requireAuth));
  });

  it('should protect creation for every role and reading for any signed-in user', () => {
    expect(requireAuth).toHaveBeenCalledWith(ROLES);
    expect(requireAuth).toHaveBeenCalledWith();
  });

  it('should answer 201 with a Location header when a booking is created', async () => {
    bookingService.createBooking.mockResolvedValue({ id: 42 });

    const res = await request(app).post('/api/bookings').send({ slotId: 1, partySize: 2 });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/bookings/42');
    expect(res.body).toEqual({ id: 42 });
    expect(bookingService.createBooking).toHaveBeenCalledWith(user, { slotId: 1, partySize: 2 });
  });

  it('should answer 409 when the booking conflicts', async () => {
    bookingService.createBooking.mockRejectedValue(new ConflictError('Insufficient capacity.', 'INSUFFICIENT_CAPACITY', []));

    const res = await request(app).post('/api/bookings').send({ slotId: 1, partySize: 2 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_CAPACITY');
  });

  it('should read a booking for the signed-in user', async () => {
    bookingService.getBooking.mockResolvedValue({ id: 42 });

    const res = await request(app).get('/api/bookings/42');

    expect(res.status).toBe(200);
    expect(bookingService.getBooking).toHaveBeenCalledWith('42', user);
  });

  it('should answer 403 when the booking belongs to someone else', async () => {
    bookingService.getBooking.mockRejectedValue(new ForbiddenError('Not yours.', 'FORBIDDEN'));

    const res = await request(app).get('/api/bookings/42');

    expect(res.status).toBe(403);
  });
});

describe('slotRoutes - Black-Box Tests', () => {
  let slotService;
  let requireAuth;
  let app;

  beforeEach(() => {
    slotService = { createSlot: vi.fn(), listSlots: vi.fn(), getSlot: vi.fn() };
    requireAuth = fakeRequireAuth();
    app = appWith('/api/slots', createSlotRouter(slotService, requireAuth));
  });

  it('should restrict every slot route to staff', () => {
    expect(requireAuth).toHaveBeenCalledTimes(1);
    expect(requireAuth).toHaveBeenCalledWith(STAFF_ROLES, STAFF_ONLY_MESSAGE);
  });

  it('should answer 201 with a Location header when a slot is created', async () => {
    slotService.createSlot.mockResolvedValue({ id: 8 });
    const body = { date: '2026-08-14', startTime: '12:00', endTime: '13:00', meal: 'lunch' };

    const res = await request(app).post('/api/slots').send(body);

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/slots/8');
    expect(slotService.createSlot).toHaveBeenCalledWith(user, body);
  });

  it('should answer 409 when the new slot overlaps another', async () => {
    slotService.createSlot.mockRejectedValue(new ConflictError('The slot overlaps another slot.', 'SLOT_OVERLAP', []));

    const res = await request(app).post('/api/slots').send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_OVERLAP');
  });

  it('should pass the filters to the slot list', async () => {
    slotService.listSlots.mockResolvedValue({ slots: [] });

    const res = await request(app).get('/api/slots?date=2026-08-14&meal=dinner');

    expect(res.status).toBe(200);
    expect(slotService.listSlots).toHaveBeenCalledWith(user, { date: '2026-08-14', meal: 'dinner' });
  });

  it('should answer 400 when the list filters are invalid', async () => {
    slotService.listSlots.mockRejectedValue(new ValidationError('bad', 'VALIDATION_ERROR', []));

    const res = await request(app).get('/api/slots?date=nope');

    expect(res.status).toBe(400);
  });

  it('should return a single slot', async () => {
    slotService.getSlot.mockResolvedValue({ id: 8 });

    const res = await request(app).get('/api/slots/8');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 8 });
    expect(slotService.getSlot).toHaveBeenCalledWith(user, '8');
  });

  it('should answer 404 when the slot does not exist', async () => {
    slotService.getSlot.mockRejectedValue(new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND'));

    const res = await request(app).get('/api/slots/999');

    expect(res.status).toBe(404);
  });
});
