import { Router } from 'express';

export function createHutRouter(slotService, requireAuth = null) {
  const router = Router();

  /** GET /api/huts/:hutId/slots – availability if date/meal/partySize provided, else list slots */
  router.get('/:hutId/slots', async (req, res, next) => {
    try {
      if (req.query.date && req.query.meal && req.query.partySize) {
        const result = await slotService.listAvailableSlots(req.params.hutId, req.query);
        return res.json(result);
      }
      const result = await slotService.listSlots(req.params.hutId, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/huts/:hutId/slots – employee only */
  router.post('/:hutId/slots', async (req, res, next) => {
    try {
      if (requireAuth) {
        return requireAuth(['employee'])(req, res, async () => {
          try {
            const result = await slotService.createSlot(req.user, req.params.hutId, req.body);
            res.status(201).set('Location', `/api/huts/${req.params.hutId}/slots/${result.id}`).json(result);
          } catch (err) {
            next(err);
          }
        });
      }
      const result = await slotService.createSlot(req.user ?? null, req.params.hutId, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/huts/:hutId/slots/:slotId/seating – public */
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

  /** GET /api/huts/:hutId/slots/:slotId */
  router.get('/:hutId/slots/:slotId', async (req, res, next) => {
    try {
      const result = await slotService.getSlot(req.params.hutId, req.params.slotId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
