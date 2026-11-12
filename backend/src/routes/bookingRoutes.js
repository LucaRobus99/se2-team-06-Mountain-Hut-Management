import { Router } from 'express';
import { ROLES } from '../auth/roles.js';

export function createBookingRouter(bookingService, requireAuth) {
  const router = Router();

  router.post('/', requireAuth(ROLES), async (req, res, next) => {
    try {
      const result = await bookingService.createBooking(req.user, req.body);
      res.status(201).set('Location', `/api/bookings/${result.id}`).json(result);
    } catch (err) {
      next(err);
    }
  });

  // MH-05 / MH-06: lista prenotazioni dell'escursionista.
  router.get('/', requireAuth(['hiker']), async (req, res, next) => {
    try {
      res.json(await bookingService.listBookings(req.user));
    } catch (err) {
      next(err);
    }
  });

  // MH-05: verifica prenotazione per uno slot.
  router.get('/slot-status', requireAuth(['hiker']), async (req, res, next) => {
    try {
      const result = await bookingService.checkSlotBooking(req.user, req.query.slotId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:bookingId', requireAuth(), async (req, res, next) => {
    try {
      const result = await bookingService.getBooking(req.params.bookingId, req.user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // MH-06: modifica prenotazione.
  router.patch('/:bookingId', requireAuth(['hiker']), async (req, res, next) => {
    try {
      const result = await bookingService.updateBooking(req.user, req.params.bookingId, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}