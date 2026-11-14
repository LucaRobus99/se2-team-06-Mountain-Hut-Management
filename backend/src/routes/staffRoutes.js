import { Router } from 'express';
import { STAFF_ONLY_MESSAGE, STAFF_ROLES } from '../auth/roles.js';

/**
 * MH-07 staff endpoints. Every route is restricted to Employee/Warden both by
 * this middleware and by the services (defence in depth). Hikers must never be
 * able to search accounts or create bookings on someone else's behalf.
 */
export function createStaffRouter({ bookingService, slotService, requireAuth }) {
  const router = Router();
  const staffOnly = requireAuth(STAFF_ROLES, STAFF_ONLY_MESSAGE);

  /** GET /api/staff/hikers?query=… – minimal hiker data for the picker. */
  router.get('/hikers', staffOnly, async (req, res, next) => {
    try {
      const term = req.query.query ?? req.query.q;
      res.json(await bookingService.searchHikers(req.user, term));
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/staff/availability?date=…&meal=…&partySize=…
   * Unlike the public availability, slots that start within two hours are
   * included (#35); slots that already started are never returned.
   */
  router.get('/availability', staffOnly, async (req, res, next) => {
    try {
      res.json(await slotService.listAvailableSlots(req.query, { staff: true }));
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/staff/availability/:slotId/seating?partySize=… */
  router.get('/availability/:slotId/seating', staffOnly, async (req, res, next) => {
    try {
      res.json(
        await slotService.getSeating(req.params.slotId, req.query, { staff: true })
      );
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/staff/bookings
   * Body: `{ mode: "existingHiker" | "guest" | "newHiker", slotId, partySize, … }`.
   * For `newHiker` the generated initial password is returned exactly once, so
   * the response must never be cached.
   */
  router.post('/bookings', staffOnly, async (req, res, next) => {
    try {
      const result = await bookingService.createStaffBooking(req.user, req.body);

      if (result.initialPassword) {
        res.set('Cache-Control', 'no-store');
      }

      res.status(201).set('Location', `/api/bookings/${result.id}`).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
