import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMenuService } from '../../../../src/services/menuService.js';

describe('menuService - White-Box Unit Tests', () => {
  let menuDao;
  let slotDao;
  let tx;
  let db;
  let service;

  beforeEach(() => {
    tx = { query: vi.fn() };
    db = {
      query: vi.fn(),
      transaction: vi.fn(async (cb) => cb(tx)),
    };
    menuDao = {
      createMenu: vi.fn(),
      findById: vi.fn(),
      findByMealAndName: vi.fn(),
      updateMenu: vi.fn(),
      listByMeal: vi.fn(),
      listAll: vi.fn(),
      listSlotMenus: vi.fn(),
      findBySlotId: vi.fn(),
      assignSlotMenu: vi.fn(),
      deleteMenu: vi.fn(),
      listSlotsReferencingMenu: vi.fn(),
    };
    slotDao = {
      findById: vi.fn(),
    };

    service = createMenuService({
      menuDao,
      slotDao,
      db,
      timeZone: 'Europe/Rome',
      now: () => new Date('2026-11-28T10:00:00.000Z'),
    });
  });

  describe('createMenu & listMenus & getMenuById & updateMenu', () => {
    it('resolves numeric and string meal identifiers and runs createMenu inside db.transaction', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2, mealType: 'lunch' }] })
        .mockResolvedValueOnce({ rows: [{ id: 4, mealType: 'dinner' }] });
      menuDao.findByMealAndName.mockResolvedValue(null);
      menuDao.createMenu.mockResolvedValue({
        id: 1,
        mealId: 2,
        name: 'Alpine Lunch',
        content: 'Polenta',
      });

      const created = await service.createMenu({
        meal: 'LUNCH',
        name: 'Alpine Lunch',
        content: 'Polenta',
      });
      expect(created).toEqual({ id: 1, mealId: 2, name: 'Alpine Lunch', content: 'Polenta' });
      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(menuDao.createMenu).toHaveBeenCalledWith(tx, {
        mealId: 2,
        name: 'Alpine Lunch',
        content: 'Polenta',
      });

      menuDao.listByMeal.mockResolvedValue([created]);
      await expect(service.listMenus({ mealId: '4' })).resolves.toEqual([created]);
    });

    it('checks name uniqueness only when name changes during updateMenu', async () => {
      menuDao.findById.mockResolvedValue({
        id: 5,
        mealId: 2,
        name: 'Same Name',
        content: 'Old',
      });
      menuDao.updateMenu.mockResolvedValue({
        id: 5,
        mealId: 2,
        name: 'Same Name',
        content: 'New',
      });

      await expect(service.updateMenu(5, { content: 'New' })).resolves.toEqual({
        id: 5,
        mealId: 2,
        name: 'Same Name',
        content: 'New',
      });
      expect(menuDao.findByMealAndName).not.toHaveBeenCalled();
      expect(menuDao.updateMenu).toHaveBeenCalledWith(tx, 5, {
        name: 'Same Name',
        content: 'New',
      });
    });
  });

  describe('assignMenuToSlot', () => {
    const futureSlot = {
      id: 10,
      date: '2027-06-15',
      start_time: '12:00',
      meal: 'lunch',
    };

    it('generates unique variant name "(2)" when saveVariant is true and name already exists', async () => {
      slotDao.findById.mockResolvedValue(futureSlot);
      menuDao.findById.mockResolvedValue({
        id: 3,
        mealId: 2,
        name: 'Base Menu',
        content: 'Original',
      });
      db.query.mockResolvedValueOnce({ rows: [{ mealType: 'lunch' }] });
      menuDao.findByMealAndName
        .mockResolvedValueOnce({ id: 3, name: 'Base Menu' })
        .mockResolvedValueOnce(null);
      menuDao.createMenu.mockResolvedValue({
        id: 99,
        mealId: 2,
        name: 'Base Menu (2)',
        content: 'Modified',
      });

      const res = await service.assignMenuToSlot(10, {
        menuId: 3,
        content: 'Modified',
        saveVariant: true,
      });

      expect(res).toEqual({
        slotId: 10,
        menuId: 99,
        saved: true,
        success: true,
      });
      expect(menuDao.createMenu).toHaveBeenCalledWith(tx, {
        mealId: 2,
        name: 'Base Menu (2)',
        content: 'Modified',
      });
      expect(menuDao.assignSlotMenu).toHaveBeenCalledWith(10, {
        menuId: 99,
        nameOverride: null,
        contentOverride: null,
      });
    });

    it('assigns unsaved variant overrides when menuId is provided without saveVariant', async () => {
      slotDao.findById.mockResolvedValue(futureSlot);
      menuDao.findById.mockResolvedValue({
        id: 3,
        mealId: 2,
        name: 'Base Menu',
        content: 'Original',
      });
      db.query.mockResolvedValueOnce({ rows: [{ mealType: 'lunch' }] });

      const res = await service.assignMenuToSlot(10, {
        menuId: 3,
        name: 'Custom Slot Name',
        saveVariant: false,
      });

      expect(res).toEqual({
        slotId: 10,
        menuId: 3,
        saved: false,
        name: 'Custom Slot Name',
        content: 'Original',
        success: true,
      });
      expect(db.transaction).not.toHaveBeenCalled();
      expect(menuDao.assignSlotMenu).toHaveBeenCalledWith(10, {
        menuId: 3,
        nameOverride: 'Custom Slot Name',
        contentOverride: 'Original',
      });
    });

    it('assigns ad-hoc menu without menuId when name and content are provided', async () => {
      slotDao.findById.mockResolvedValue(futureSlot);
      db.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });

      const res = await service.assignMenuToSlot(10, {
        name: 'Ad-hoc',
        content: 'Soup',
      });

      expect(res).toEqual({
        slotId: 10,
        menuId: null,
        saved: false,
        name: 'Ad-hoc',
        content: 'Soup',
        success: true,
      });
      expect(menuDao.assignSlotMenu).toHaveBeenCalledWith(10, {
        menuId: null,
        nameOverride: 'Ad-hoc',
        contentOverride: 'Soup',
      });
    });
  });

  describe('deleteMenu, publicSlotMenus & publicSlotMenu', () => {
    it('deletes menu when referencing slots are all in the future', async () => {
      menuDao.findById.mockResolvedValue({ id: 4, mealId: 2, name: 'Future Only' });
      menuDao.listSlotsReferencingMenu.mockResolvedValue([
        { id: 20, date: '2027-07-01', start_time: '12:00' },
      ]);

      await service.deleteMenu('4');

      expect(menuDao.deleteMenu).toHaveBeenCalledWith(tx, 4);
    });

    it('maps override, saved menu, and null menu in publicSlotMenus', async () => {
      menuDao.listSlotMenus.mockResolvedValue([
        {
          slotId: 1,
          date: '2026-12-01',
          startTime: '12:00',
          endTime: '13:00',
          meal: 'lunch',
          menuId: 2,
          menuName: 'Base',
          menuContent: 'Base dishes',
          menuNameOverride: 'Override Name',
          menuContentOverride: 'Override dishes',
        },
        {
          slotId: 2,
          date: '2026-12-01',
          startTime: '19:00',
          endTime: '20:00',
          meal: 'dinner',
          menuId: 5,
          menuName: 'Dinner Lib',
          menuContent: 'Steak',
          menuNameOverride: null,
          menuContentOverride: null,
        },
        {
          slotId: 3,
          date: '2026-12-01',
          startTime: '08:00',
          endTime: '09:00',
          meal: 'breakfast',
          menuId: null,
          menuName: null,
          menuContent: null,
          menuNameOverride: null,
          menuContentOverride: null,
        },
      ]);

      const result = await service.publicSlotMenus({ date: '2026-12-01' });

      expect(result).toEqual({
        date: '2026-12-01',
        meal: null,
        slots: [
          {
            slotId: 1,
            date: '2026-12-01',
            startTime: '12:00',
            endTime: '13:00',
            meal: 'lunch',
            menu: { id: 2, name: 'Override Name', content: 'Override dishes', saved: false },
          },
          {
            slotId: 2,
            date: '2026-12-01',
            startTime: '19:00',
            endTime: '20:00',
            meal: 'dinner',
            menu: { id: 5, name: 'Dinner Lib', content: 'Steak', saved: true },
          },
          {
            slotId: 3,
            date: '2026-12-01',
            startTime: '08:00',
            endTime: '09:00',
            meal: 'breakfast',
            menu: null,
          },
        ],
      });
    });
  });
});