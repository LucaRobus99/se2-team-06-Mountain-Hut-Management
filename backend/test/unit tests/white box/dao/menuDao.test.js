import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMenuDao } from '../../../../src/dao/menuDao.js';

describe('menuDao - White-Box Tests', () => {
  let db;
  let tx;
  let dao;

  beforeEach(() => {
    db = { query: vi.fn() };
    tx = { query: vi.fn() };
    dao = createMenuDao(db);
  });

  describe('createMenu', () => {
    it('should insert a menu and return the created row', async () => {
      const created = {
        id: 1,
        mealId: 2,
        name: 'Alpine Lunch',
        content: 'Polenta e funghi',
        updatedAt: '2026-11-28T10:00:00.000Z',
      };
      db.query.mockResolvedValue({ rows: [created] });

      await expect(
        dao.createMenu({ mealId: 2, name: 'Alpine Lunch', content: 'Polenta e funghi' })
      ).resolves.toEqual(created);

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO menus');
      expect(sql).toContain('RETURNING id, meal_id AS "mealId", name, content, updated_at AS "updatedAt"');
      expect(params).toEqual([2, 'Alpine Lunch', 'Polenta e funghi']);
    });

    it('should use the transaction executor when one is passed first', async () => {
      const created = {
        id: 10,
        mealId: 1,
        name: 'Tx Menu',
        content: 'Soup',
        updatedAt: '2026-11-28T10:00:00.000Z',
      };
      tx.query.mockResolvedValue({ rows: [created] });

      await expect(
        dao.createMenu(tx, { mealId: 1, name: 'Tx Menu', content: 'Soup' })
      ).resolves.toEqual(created);

      expect(tx.query).toHaveBeenCalledTimes(1);
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('findById & findByMealAndName', () => {
    it('should return the menu when found by id and null when missing', async () => {
      const menu = { id: 3, mealId: 2, name: 'Classic', content: 'Pasta', updatedAt: '2026-11-28T10:00:00.000Z' };
      db.query.mockResolvedValueOnce({ rows: [menu] });
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(dao.findById(3)).resolves.toEqual(menu);
      expect(db.query.mock.calls[0][1]).toEqual([3]);

      await expect(dao.findById(404)).resolves.toBeNull();
    });

    it('should return the menu when found by mealId and name and null when missing', async () => {
      const menu = { id: 4, mealId: 2, name: 'Winter', content: 'Stew', updatedAt: '2026-11-28T10:00:00.000Z' };
      db.query.mockResolvedValueOnce({ rows: [menu] });
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(dao.findByMealAndName(2, 'Winter')).resolves.toEqual(menu);
      expect(db.query.mock.calls[0][1]).toEqual([2, 'Winter']);

      await expect(dao.findByMealAndName(2, 'Unknown')).resolves.toBeNull();
    });
  });

  describe('updateMenu', () => {
    it('should pass COALESCE parameters and return updated row or null', async () => {
      const updated = {
        id: 5,
        mealId: 2,
        name: 'Updated Name',
        content: 'Existing Content',
        updatedAt: '2026-11-28T11:00:00.000Z',
      };
      db.query.mockResolvedValueOnce({ rows: [updated] });
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(dao.updateMenu(5, { name: 'Updated Name', content: null })).resolves.toEqual(updated);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('SET name = COALESCE($2, name)');
      expect(sql).toContain('content = COALESCE($3, content)');
      expect(params).toEqual([5, 'Updated Name', null]);

      await expect(dao.updateMenu(999, { name: 'Ghost', content: 'None' })).resolves.toBeNull();
    });
  });

  describe('listByMeal & listAll', () => {
    it('should list menus by meal ordered by name and id', async () => {
      const rows = [{ id: 1, mealId: 2, name: 'Menu A', content: 'C1', updatedAt: '2026-11-28T10:00:00.000Z' }];
      db.query.mockResolvedValue({ rows });

      await expect(dao.listByMeal(2)).resolves.toEqual(rows);
      expect(db.query.mock.calls[0][0]).toContain('ORDER BY name, id');
      expect(db.query.mock.calls[0][1]).toEqual([2]);
    });

    it('should join meals in listAll without parameters', async () => {
      const rows = [{ id: 1, mealId: 2, meal: 'lunch', name: 'Menu A', content: 'C1', updatedAt: '2026-11-28T10:00:00.000Z' }];
      db.query.mockResolvedValue({ rows });

      await expect(dao.listAll()).resolves.toEqual(rows);
      expect(db.query.mock.calls[0][0]).toContain('JOIN meals me ON me.id = m.meal_id');
      expect(db.query.mock.calls[0][1]).toBeUndefined();
    });
  });

  describe('listSlotMenus & findBySlotId', () => {
    it('should omit meal filter when mealType is not provided', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await dao.listSlotMenus('2026-11-28');

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('WHERE s.date = $1 AND s.archived_at IS NULL');
      expect(sql).not.toContain('AND m.meal_type = $2');
      expect(params).toEqual(['2026-11-28']);
    });

    it('should append meal filter when mealType is provided', async () => {
      const rows = [{ slotId: 7, date: '2026-11-28', meal: 'dinner', menuId: null }];
      db.query.mockResolvedValue({ rows });

      await expect(dao.listSlotMenus('2026-11-28', 'dinner')).resolves.toEqual(rows);

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('AND m.meal_type = $2');
      expect(params).toEqual(['2026-11-28', 'dinner']);
    });

    it('should return slot menu row when active and null when missing or archived', async () => {
      const row = { slotId: 8, date: '2026-11-28', meal: 'lunch', menuId: 2 };
      db.query.mockResolvedValueOnce({ rows: [row] });
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(dao.findBySlotId(8)).resolves.toEqual(row);
      expect(db.query.mock.calls[0][0]).toContain('WHERE s.id = $1 AND s.archived_at IS NULL');
      expect(db.query.mock.calls[0][1]).toEqual([8]);

      await expect(dao.findBySlotId(8)).resolves.toBeNull();
    });
  });

  describe('assignSlotMenu', () => {
    it('should default omitted override fields to null', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await dao.assignSlotMenu(12, {});

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('UPDATE slots');
      expect(params).toEqual([null, null, null, 12]);
    });

    it('should pass explicit menuId, nameOverride, and contentOverride values', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await dao.assignSlotMenu(12, { menuId: 4, nameOverride: 'Custom', contentOverride: 'Items' });

      expect(db.query.mock.calls[0][1]).toEqual([4, 'Custom', 'Items', 12]);
    });
  });

  describe('deleteMenu & listSlotsReferencingMenu', () => {
    it('should delete menu using the resolved executor', async () => {
      tx.query.mockResolvedValue({ rows: [] });

      await dao.deleteMenu(tx, 15);

      expect(tx.query).toHaveBeenCalledWith('DELETE FROM menus WHERE id = $1', [15]);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should list slots referencing menuId ordered by date and start_time', async () => {
      const refs = [{ id: 1, date: '2026-11-28', start_time: '12:00' }];
      db.query.mockResolvedValue({ rows: refs });

      await expect(dao.listSlotsReferencingMenu(15)).resolves.toEqual(refs);
      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, date, start_time FROM slots WHERE menu_id = $1 ORDER BY date, start_time',
        [15]
      );
    });
  });
});