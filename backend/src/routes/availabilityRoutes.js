import { Router } from 'express';

/** Public availability (MH-01 slot choice, MH-04) and public menu lookup (MH-10-04): no login required. */
export function createAvailabilityRouter(slotService, menuService) {
  const router = Router();

  /** GET /api/availability/menus?date=…&meal=… */
  router.get('/menus', async (req, res, next) => {
    try {
      const result = await menuService.publicSlotMenus(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/availability/:slotId/menu */
  router.get('/:slotId/menu', async (req, res, next) => {
    try {
      const result = await menuService.publicSlotMenu(req.params.slotId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

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
