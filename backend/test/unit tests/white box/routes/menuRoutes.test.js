import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMenuRouter, createSlotMenuRouter } from '../../../../src/routes/menuRoutes.js';
import { STAFF_ONLY_MESSAGE, STAFF_ROLES } from '../../../../src/auth/roles.js';

describe('menuRoutes - White-Box Tests', () => {
  let menuService;
  let requireAuth;
  let guardMiddleware;

  beforeEach(() => {
    menuService = {
      createMenu: vi.fn(),
      listMenus: vi.fn(),
      getMenuById: vi.fn(),
      updateMenu: vi.fn(),
      deleteMenu: vi.fn(),
      assignMenuToSlot: vi.fn(),
    };
    guardMiddleware = vi.fn((_req, _res, next) => next());
    requireAuth = vi.fn(() => guardMiddleware);
  });

  describe('createMenuRouter', () => {
    it('registers staffOnly middleware on every menu route', () => {
      const router = createMenuRouter(menuService, requireAuth);

      expect(requireAuth).toHaveBeenCalledTimes(1);
      expect(requireAuth).toHaveBeenCalledWith(STAFF_ROLES, STAFF_ONLY_MESSAGE);

      const routes = router.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
          handlers: layer.route.stack.map((s) => s.handle),
        }));

      expect(routes).toHaveLength(5);
      for (const route of routes) {
        expect(route.handlers[0]).toBe(guardMiddleware);
        expect(typeof route.handlers[1]).toBe('function');
      }

      expect(routes.map(({ path, methods }) => ({ path, methods }))).toEqual([
        { path: '/', methods: ['post'] },
        { path: '/', methods: ['get'] },
        { path: '/:id', methods: ['get'] },
        { path: '/:id', methods: ['put'] },
        { path: '/:id', methods: ['delete'] },
      ]);
    });

    it('forwards errors rejected by menuService to next(err)', async () => {
      const boom = new Error('Database failure');
      menuService.createMenu.mockRejectedValueOnce(boom);
      const router = createMenuRouter(menuService, requireAuth);

      const postLayer = router.stack.find(
        (layer) => layer.route && layer.route.path === '/' && layer.route.methods.post
      );
      const routeHandler = postLayer.route.stack[postLayer.route.stack.length - 1].handle;
      const next = vi.fn();

      await routeHandler({ body: { name: 'Test' } }, {}, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  describe('createSlotMenuRouter', () => {
    it('registers staffOnly middleware on PUT /:slotId/menu', () => {
      const router = createSlotMenuRouter(menuService, requireAuth);

      expect(requireAuth).toHaveBeenCalledTimes(1);
      expect(requireAuth).toHaveBeenCalledWith(STAFF_ROLES, STAFF_ONLY_MESSAGE);

      const putSlotMenu = router.stack.find(
        (layer) => layer.route && layer.route.path === '/:slotId/menu' && layer.route.methods.put
      );
      expect(putSlotMenu).toBeDefined();
      expect(putSlotMenu.route.stack[0].handle).toBe(guardMiddleware);
    });

    it('forwards errors rejected by assignMenuToSlot to next(err)', async () => {
      const err = new Error('Invalid slot');
      menuService.assignMenuToSlot.mockRejectedValueOnce(err);
      const router = createSlotMenuRouter(menuService, requireAuth);

      const putSlotMenu = router.stack.find(
        (layer) => layer.route && layer.route.path === '/:slotId/menu' && layer.route.methods.put
      );
      const routeHandler = putSlotMenu.route.stack[putSlotMenu.route.stack.length - 1].handle;
      const next = vi.fn();

      await routeHandler({ params: { slotId: '10' }, body: { menuId: 2 } }, {}, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});