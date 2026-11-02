import { Router } from 'express';

/** Public availability (MH-01 slot choice, MH-04): no login required. */
export function createAvailabilityRouter(slotService) {
  const router = Router();

  /** GET /api/availability?date=…&meal=…&partySize=… */
  router.get('/', async (req, res, next) => {
    try {
      const result = await slotService.listAvailableSlots(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/availability/:slotId/seating?partySize=… */
  router.get('/:slotId/seating', async (req, res, next) => {
    try {
      const result = await slotService.getSeating(req.params.slotId, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
