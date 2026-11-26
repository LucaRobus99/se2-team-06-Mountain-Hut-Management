import { NotFoundError, ConflictError, ValidationError } from '../errors/AppError.js';
import { validateMenuInput } from './menuValidation.js';

const ALLOWED_MEALS = ['breakfast', 'lunch', 'aperitivo', 'dinner'];

export function createMenuService({ menuDao, slotDao, db }) {
  async function resolveMealId(mealInput) {
    if (typeof mealInput === 'number' || (typeof mealInput === 'string' && /^\d+$/.test(mealInput))) {
      const id = Number(mealInput);
      // Verify meal ID exists by querying meals table or checking slotDao
      // Let's check meals via a quick query or slotDao helper
      const meal = await db.query('SELECT id, meal_type AS "mealType" FROM meals WHERE id = $1', [id]);
      if (meal.rows.length === 0) {
        throw new NotFoundError('Meal not found.', 'MEAL_NOT_FOUND');
      }
      return meal.rows[0].id;
    } else if (typeof mealInput === 'string' && ALLOWED_MEALS.includes(mealInput.toLowerCase())) {
      const mealType = mealInput.toLowerCase();
      const meal = await db.query('SELECT id, meal_type AS "mealType" FROM meals WHERE meal_type = $1', [mealType]);
      if (meal.rows.length === 0) {
        throw new NotFoundError('Meal not found.', 'MEAL_NOT_FOUND');
      }
      return meal.rows[0].id;
    } else {
      throw new ValidationError('Invalid meal identifier or type.', 'VALIDATION_ERROR');
    }
  }

  return {
    async createMenu(rawInput) {
      const validated = validateMenuInput(rawInput);
      const mealId = await resolveMealId(rawInput.mealId ?? rawInput.meal);

      // Check if menu with same name already exists for this meal
      const existing = await menuDao.findByMealAndName(mealId, validated.name);
      if (existing) {
        throw new ConflictError('A menu with this name already exists for this meal.', 'MENU_CONFLICT');
      }

      return await db.transaction(async (tx) => {
        const created = await menuDao.createMenu(tx, {
          mealId,
          name: validated.name,
          content: validated.content,
        });
        return created;
      });
    },

    async updateMenu(menuId, rawInput) {
      const parsedId = Number(menuId);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        throw new ValidationError('Invalid menu ID.', 'VALIDATION_ERROR');
      }

      const existingMenu = await menuDao.findById(parsedId);
      if (!existingMenu) {
        throw new NotFoundError('Menu not found.', 'MENU_NOT_FOUND');
      }

      const validated = validateMenuInput({
        name: rawInput.name ?? existingMenu.name,
        content: rawInput.content ?? existingMenu.content,
      });

      // If name is changing, check uniqueness for the same meal
      if (validated.name !== existingMenu.name) {
        const conflict = await menuDao.findByMealAndName(existingMenu.mealId, validated.name);
        if (conflict && conflict.id !== parsedId) {
          throw new ConflictError('A menu with this name already exists for this meal.', 'MENU_CONFLICT');
        }
      }

      return await db.transaction(async (tx) => {
        const updated = await menuDao.updateMenu(tx, parsedId, {
          name: validated.name,
          content: validated.content,
        });
        return updated;
      });
    },

    async getMenuById(menuId) {
      const parsedId = Number(menuId);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        throw new ValidationError('Invalid menu ID.', 'VALIDATION_ERROR');
      }
      const menu = await menuDao.findById(parsedId);
      if (!menu) {
        throw new NotFoundError('Menu not found.', 'MENU_NOT_FOUND');
      }
      return menu;
    },

    async listMenus(query = {}) {
      const mealQuery = query.mealId ?? query.meal;
      if (mealQuery !== undefined && mealQuery !== null) {
        const mealId = await resolveMealId(mealQuery);
        return await menuDao.listByMeal(mealId);
      }
      return await menuDao.listAll();
    },

    async assignMenuToSlot(slotId, { menuId, content, name, mealId }) {
      const parsedSlotId = Number(slotId);
      if (!Number.isInteger(parsedSlotId) || parsedSlotId <= 0) {
        throw new ValidationError('Invalid slot ID.', 'VALIDATION_ERROR');
      }

      const slot = await slotDao.findById(parsedSlotId);
      if (!slot) {
        throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');
      }

      let resolvedMenuId;

      if (menuId !== undefined && menuId !== null) {
        // Reusing an existing menu (optionally modified or direct)
        const parsedMenuId = Number(menuId);
        const menu = await menuDao.findById(parsedMenuId);
        if (!menu) {
          throw new NotFoundError('Menu not found.', 'MENU_NOT_FOUND');
        }

        // If content/name are also provided, support modified copy before assignment (MH-10-03)
        if (content !== undefined || name !== undefined) {
          const validated = validateMenuInput({
            name: name ?? menu.name,
            content: content ?? menu.content,
          });
          // Create a new version/copy of the menu or update
          resolvedMenuId = await db.transaction(async (tx) => {
            const newMenu = await menuDao.createMenu(tx, {
              mealId: menu.mealId,
              name: validated.name,
              content: validated.content,
            });
            return newMenu.id;
          });
        } else {
          // Verify menu meal matches slot meal
          const mealCheck = await db.query('SELECT meal_type AS "mealType" FROM meals WHERE id = $1', [menu.mealId]);
          if (mealCheck.rows[0]?.mealType !== slot.meal) {
            throw new ValidationError('Menu meal type does not match slot meal type.', 'MEAL_MISMATCH');
          }
          resolvedMenuId = menu.id;
        }
      } else if (content !== undefined && name !== undefined) {
        // Creating a new ad-hoc menu for this slot
        const resolvedMeal = await db.query('SELECT id FROM meals WHERE meal_type = $1', [slot.meal]);
        const slotMealId = resolvedMeal.rows[0].id;
        const validated = validateMenuInput({ name, content });

        resolvedMenuId = await db.transaction(async (tx) => {
          const newMenu = await menuDao.createMenu(tx, {
            mealId: slotMealId,
            name: validated.name,
            content: validated.content,
          });
          return newMenu.id;
        });
      } else {
        throw new ValidationError('Either menuId or valid name and content must be provided for slot assignment.', 'VALIDATION_ERROR');
      }

      // Associate menu with slot
      await db.query('UPDATE slots SET menu_id = $1 WHERE id = $2', [resolvedMenuId, parsedSlotId]);

      return {
        slotId: parsedSlotId,
        menuId: resolvedMenuId,
        success: true,
      };
    },
  };
}
