import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMenuService } from '../../../../src/services/menuService.js';
import {
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from '../../../../src/errors/AppError.js';

describe('menuService - Black-Box Unit Tests', () => {
  let menuDao;
  let slotDao;
  let db;
  let service;

  beforeEach(() => {
    db = {
      query: vi.fn(),
      transaction: vi.fn(async (cb) => cb(db)),
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

  it('throws ConflictError when creating a duplicate menu name for the same meal', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 2, mealType: 'lunch' }] });
    menuDao.findByMealAndName.mockResolvedValue({ id: 1, name: 'Classic' });

    await expect(
      service.createMenu({ meal: 'lunch', name: 'Classic', content: 'Polenta' })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws ValidationError for invalid menu IDs and NotFoundError when menu is missing', async () => {
    await expect(service.getMenuById('abc')).rejects.toBeInstanceOf(ValidationError);

    menuDao.findById.mockResolvedValue(null);
    await expect(service.getMenuById(999)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects assigning a menu to a slot that has already started with UnprocessableEntityError', async () => {
    slotDao.findById.mockResolvedValue({
      id: 5,
      date: '2026-11-20',
      start_time: '12:00',
      meal: 'lunch',
    });

    await expect(
      service.assignMenuToSlot(5, { name: 'Late Menu', content: 'Soup' })
    ).rejects.toBeInstanceOf(UnprocessableEntityError);
  });

  it('rejects assigning a menu whose meal type does not match the slot meal type', async () => {
    slotDao.findById.mockResolvedValue({
      id: 5,
      date: '2027-06-15',
      start_time: '12:00',
      meal: 'lunch',
    });
    menuDao.findById.mockResolvedValue({
      id: 8,
      mealId: 4,
      name: 'Dinner Only',
      content: 'Roast',
    });
    db.query.mockResolvedValueOnce({ rows: [{ mealType: 'dinner' }] });

    await expect(service.assignMenuToSlot(5, { menuId: 8 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ConflictError when deleting a menu referenced by a past slot', async () => {
    menuDao.findById.mockResolvedValue({ id: 6, mealId: 2, name: 'Past Menu' });
    menuDao.listSlotsReferencingMenu.mockResolvedValue([
      { id: 1, date: '2025-01-10', start_time: '12:00' },
    ]);

    await expect(service.deleteMenu(6)).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws NotFoundError in publicSlotMenu when slot does not exist', async () => {
    menuDao.findBySlotId.mockResolvedValue(null);

    await expect(service.publicSlotMenu(123)).rejects.toBeInstanceOf(NotFoundError);
  });
});