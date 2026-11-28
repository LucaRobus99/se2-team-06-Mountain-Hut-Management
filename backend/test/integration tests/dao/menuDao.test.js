import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../helpers/dbHelper.js';
import { createMenuDao } from '../../../src/dao/menuDao.js';

describe('MenuDao - Integration Tests', () => {
  let db;
  let menuDao;

  beforeEach(() => {
    // Initialize a clean test database (PostgreSQL) with schema and seed data
    db = createTestDb();
    menuDao = createMenuDao(db);
  });

  afterEach(async () => {
    // Close the database connection after each test
    await db.close();
  });

  describe('createMenu, findById, findByMealAndName, updateMenu, listByMeal and listAll', () => {
    it('should create, retrieve, update, and list menus by meal and across all meals', async () => {
      const { rows: meals } = await db.query('SELECT id, meal_type FROM meals ORDER BY id');
      const lunchMeal = meals.find((m) => m.meal_type === 'lunch') ?? meals[0];

      const created = await menuDao.createMenu({
        mealId: lunchMeal.id,
        name: 'Refuge Classic',
        content: 'Polenta e spezzatino',
      });

      expect(created).toMatchObject({
        mealId: lunchMeal.id,
        name: 'Refuge Classic',
        content: 'Polenta e spezzatino',
      });
      expect(created.id).toBeDefined();
      expect(created.updatedAt).toBeTruthy();

      await expect(menuDao.findById(created.id)).resolves.toMatchObject({
        id: created.id,
        name: 'Refuge Classic',
      });

      await expect(menuDao.findByMealAndName(lunchMeal.id, 'Refuge Classic')).resolves.toMatchObject({
        id: created.id,
      });

      const updated = await menuDao.updateMenu(created.id, {
        name: 'Refuge Updated',
        content: null,
      });
      expect(updated).toMatchObject({
        id: created.id,
        name: 'Refuge Updated',
        content: 'Polenta e spezzatino',
      });

      const byMeal = await menuDao.listByMeal(lunchMeal.id);
      expect(byMeal.some((m) => m.id === created.id)).toBe(true);

      const all = await menuDao.listAll();
      expect(all.some((m) => m.id === created.id && m.meal === lunchMeal.meal_type)).toBe(true);
    });

    it('should return null when looking up or updating non-existent menus', async () => {
      await expect(menuDao.findById(999999)).resolves.toBeNull();
      await expect(menuDao.findByMealAndName(1, 'Non Existent Menu')).resolves.toBeNull();
      await expect(menuDao.updateMenu(999999, { name: 'Ghost', content: 'None' })).resolves.toBeNull();
    });
  });

  describe('assignSlotMenu, findBySlotId and listSlotMenus', () => {
    it('should assign library and ad-hoc/override menus to slots and filter archived slots', async () => {
      const { rows: slots } = await db.query('SELECT id, meal_id FROM slots ORDER BY id LIMIT 2');
      const { rows: meals } = await db.query('SELECT id, meal_type FROM meals WHERE id = $1', [slots[0].meal_id]);
      const mealType = meals[0].meal_type;

      const menu = await menuDao.createMenu({
        mealId: slots[0].meal_id,
        name: 'Autumn Menu',
        content: 'Soup and cheese',
      });

      await menuDao.assignSlotMenu(slots[0].id, {
        menuId: menu.id,
        nameOverride: null,
        contentOverride: null,
      });

      const slotMenu = await menuDao.findBySlotId(slots[0].id);
      expect(slotMenu).toMatchObject({
        slotId: slots[0].id,
        menuId: menu.id,
        menuName: 'Autumn Menu',
        menuContent: 'Soup and cheese',
        menuNameOverride: null,
        menuContentOverride: null,
      });

      // Re-assigning to an ad-hoc override clears stale library link and sets overrides
      await menuDao.assignSlotMenu(slots[0].id, {
        menuId: null,
        nameOverride: 'Custom Group Menu',
        contentOverride: 'Pasta al ragu',
      });

      const overriddenSlot = await menuDao.findBySlotId(slots[0].id);
      expect(overriddenSlot).toMatchObject({
        slotId: slots[0].id,
        menuId: null,
        menuNameOverride: 'Custom Group Menu',
        menuContentOverride: 'Pasta al ragu',
      });

      const dayRowsWithMeal = await menuDao.listSlotMenus(overriddenSlot.date, mealType);
      expect(dayRowsWithMeal.some((r) => r.slotId === slots[0].id)).toBe(true);

      const dayRowsAllMeals = await menuDao.listSlotMenus(overriddenSlot.date);
      expect(dayRowsAllMeals.some((r) => r.slotId === slots[0].id)).toBe(true);
    });
  });

  describe('listSlotsReferencingMenu and deleteMenu', () => {
    it('should track referencing slots (including archived) and set menu_id to null on deleteMenu', async () => {
      const { rows: slots } = await db.query('SELECT id, meal_id FROM slots ORDER BY id LIMIT 1');
      const targetSlotId = slots[0].id;

      const menu = await menuDao.createMenu({
        mealId: slots[0].meal_id,
        name: 'Temporary Menu',
        content: 'Tart',
      });

      await menuDao.assignSlotMenu(targetSlotId, {
        menuId: menu.id,
        nameOverride: null,
        contentOverride: null,
      });

      await db.query('UPDATE slots SET archived_at = NOW() WHERE id = $1', [targetSlotId]);

      // Archived slots are excluded from findBySlotId, but kept in listSlotsReferencingMenu
      await expect(menuDao.findBySlotId(targetSlotId)).resolves.toBeNull();
      const refs = await menuDao.listSlotsReferencingMenu(menu.id);
      expect(refs.some((r) => r.id === targetSlotId)).toBe(true);

      // Deleting the menu sets slots.menu_id to NULL via ON DELETE SET NULL
      await menuDao.deleteMenu(menu.id);
      await expect(menuDao.findById(menu.id)).resolves.toBeNull();
      const { rows: afterDelete } = await db.query('SELECT menu_id FROM slots WHERE id = $1', [targetSlotId]);
      expect(afterDelete[0].menu_id).toBeNull();
    });
  });
});