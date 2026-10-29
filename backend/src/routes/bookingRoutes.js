import { Router } from 'express';

export function createBookingRouter(bookingService, requireAuth) {
  const router = Router();

  /** POST /api/bookings – only authenticated hikers can book online. */
  router.post('/', requireAuth(['hiker']), async (req, res, next) => {
    try {
      const result = await bookingService.createBooking(req.user, req.body);
      res.status(201).set('Location', `/api/bookings/${result.id}`).json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/bookings/:bookingId – hiker own bookings, staff any booking. */
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
