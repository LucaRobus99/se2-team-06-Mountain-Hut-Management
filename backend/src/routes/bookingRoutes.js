import { Router } from 'express';

export function createBookingRouter(bookingService) {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const result = await bookingService.createBooking(req.body);
      res.status(201).set('Location', `/api/bookings/${result.id}`).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}