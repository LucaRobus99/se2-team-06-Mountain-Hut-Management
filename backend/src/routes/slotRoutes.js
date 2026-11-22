import { Router } from 'express';
import { STAFF_ONLY_MESSAGE, STAFF_ROLES } from '../auth/roles.js';

/** MH-02 slot management. Staff only (employee and warden). */
export function createSlotRouter(slotService, requireAuth) {
  const router = Router();
  const staffOnly = requireAuth(STAFF_ROLES, STAFF_ONLY_MESSAGE);

  /** POST /api/slots */
  router.post('/', staffOnly, async (req, res, next) => {
    try {
      const result = await slotService.createSlot(req.user, req.body);
      res.status(201).set('Location', `/api/slots/${result.id}`).json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/slots?date=…&meal=… – date defaults to today (hut time); other parameters are ignored */
  router.get('/', staffOnly, async (req, res, next) => {
    try {
      const result = await slotService.listSlots(req.user, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** Fixed-capacity tables and reusable service times (#47). */
  router.get('/catalog', staffOnly, async (req, res, next) => {
    try {
      res.json(await slotService.listCatalog(req.user));
    } catch (err) { next(err); }
  });

  router.post('/tables', staffOnly, async (req, res, next) => {
    try {
      res.status(201).json(await slotService.createCatalogTable(req.user, req.body));
    } catch (err) { next(err); }
  });

  /** GET /api/slots/:slotId */
  router.get('/:slotId', staffOnly, async (req, res, next) => {
    try {
      const result = await slotService.getSlot(req.user, req.params.slotId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
