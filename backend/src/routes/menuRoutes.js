import { Router } from 'express';
import { STAFF_ONLY_MESSAGE, STAFF_ROLES } from '../auth/roles.js';

export function createMenuRouter(menuService, requireAuth) {
  const router = Router();
  const staffOnly = requireAuth(STAFF_ROLES, STAFF_ONLY_MESSAGE);

  /** POST /api/menus - Create a named rich-text menu */
  router.post('/', staffOnly, async (req, res, next) => {
    try {
      const menu = await menuService.createMenu(req.body);
      res.status(201).set('Location', `/api/menus/${menu.id}`).json(menu);
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/menus - List all menus or filter by meal (?meal=... or ?mealId=...) */
  router.get('/', staffOnly, async (req, res, next) => {
    try {
      const menus = await menuService.listMenus(req.query);
      res.json(menus);
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/menus/:id - Get menu by ID */
  router.get('/:id', staffOnly, async (req, res, next) => {
    try {
      const menu = await menuService.getMenuById(req.params.id);
      res.json(menu);
    } catch (err) {
      next(err);
    }
  });

  /** PUT /api/menus/:id - Update menu name or rich-text content */
  router.put('/:id', staffOnly, async (req, res, next) => {
    try {
      const updated = await menuService.updateMenu(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  /**
   * DELETE /api/menus/:id - Remove a menu from the library.
   * Blocked (409) while any past slot still references it; referencing
   * future slots are released (their menu_id is set to NULL).
   */
  router.delete('/:id', staffOnly, async (req, res, next) => {
    try {
      await menuService.deleteMenu(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  /** PUT /api/slots/:slotId/menu - Assign menu (or reused/revised copy) to a slot */
  // Note: this route can be mounted at /api/slots/:slotId/menu or handled here.
  // We can also attach a subrouter or export a helper.

  return router;
}

export function createSlotMenuRouter(menuService, requireAuth) {
  const router = Router();
  const staffOnly = requireAuth(STAFF_ROLES, STAFF_ONLY_MESSAGE);

  /** PUT /api/slots/:slotId/menu - Assign menu to slot */
  router.put('/:slotId/menu', staffOnly, async (req, res, next) => {
    try {
      const result = await menuService.assignMenuToSlot(req.params.slotId, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
