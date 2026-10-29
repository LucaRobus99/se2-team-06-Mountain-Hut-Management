import { Router } from 'express';

export function createHutRouter(slotService) {
  const router = Router();

  /** GET /api/huts/:hutId/slots?date=…&meal=…&partySize=… – public */
  router.get('/:hutId/slots', async (req, res, next) => {
    try {
      const result = await slotService.listAvailableSlots(req.params.hutId, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/huts/:hutId/slots/:slotId/seating?partySize=… – public */
  router.get('/:hutId/slots/:slotId/seating', async (req, res, next) => {
    try {
      const result = await slotService.getSeating(
        req.params.hutId,
        req.params.slotId,
        req.query
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
