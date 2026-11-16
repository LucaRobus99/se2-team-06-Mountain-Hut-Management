import { Router } from 'express';
import { HIKER_BOOKING_MESSAGE, HIKER_CANCEL_MESSAGE } from '../auth/roles.js';

export function createBookingRouter(bookingService, requireAuth) {
  const router = Router();

  // MH-01: hikers book for themselves. Staff use POST /api/staff/bookings (MH-07).
  router.post('/', requireAuth(['hiker'], HIKER_BOOKING_MESSAGE), async (req, res, next) => {
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

  // MH-08: annullamento prenotazione (idempotente, nessun limite temporale).
  router.delete('/:bookingId', requireAuth(['hiker'], HIKER_CANCEL_MESSAGE), async (req, res, next) => {
    try {
      const result = await bookingService.cancelBooking(req.user, req.params.bookingId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}