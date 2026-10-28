import { Router } from 'express';

export function createSlotRouter(slotService) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const result = await slotService.listAvailableSlots(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

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