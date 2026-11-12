import { Router } from 'express';
import { ROLES } from '../auth/roles.js';

export function createBookingRouter(bookingService, requireAuth) {
  const router = Router();

  /** POST /api/bookings – hikers book for themselves, staff book on behalf of a guest. */
  router.post('/', requireAuth(ROLES), async (req, res, next) => {
    try {
      const result = await bookingService.createBooking(req.user, req.body);
      res.status(201).set('Location', `/api/bookings/${result.id}`).json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/bookings – booking history of the authenticated hiker. */
  router.get('/', requireAuth(['hiker']), async (req, res, next) => {
    try {
      res.json(await bookingService.listMyBookings(req.user));
    } catch (err) {
      next(err);
    }
  });

  // Check the signed-in hiker's slot before opening the dietary requirements form.
  // The POST still enforces this rule inside its transaction for concurrent requests.
  router.get('/slot-status', requireAuth(['hiker']), async (req, res, next) => {
    try {
      const result = await bookingService.checkSlotBooking(req.user, req.query.slotId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/bookings/:bookingId – hikers read their own bookings, staff every booking. */
  router.get('/:bookingId', requireAuth(), async (req, res, next) => {
    try {
      const result = await bookingService.getBooking(req.params.bookingId, req.user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
