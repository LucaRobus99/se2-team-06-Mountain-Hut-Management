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
