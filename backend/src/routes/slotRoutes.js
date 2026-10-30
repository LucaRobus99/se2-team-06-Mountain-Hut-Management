import { Router } from 'express';

export function createSlotRouter(slotService, requireAuth) {
  const router = Router();

  /** POST /api/slots – employee only */
  router.post('/', requireAuth(['employee']), async (req, res, next) => {
    try {
      const result = await slotService.createSlot(req.user, null, req.body);
      res.status(201).set('Location', `/api/slots/${result.id}`).json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/slots – list slots (optional ?date=&hutId=) */
  router.get('/', async (req, res, next) => {
    try {
      const hutId = req.query.hutId ?? req.user?.hutId ?? 1;
      const result = await slotService.listSlots(hutId, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/slots/:slotId */
  router.get('/:slotId', async (req, res, next) => {
    try {
      const hutId = req.query.hutId ?? req.user?.hutId ?? 1;
      const result = await slotService.getSlot(hutId, req.params.slotId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}