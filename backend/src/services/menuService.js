import {
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
  ValidationError,
} from '../errors/AppError.js';
import { validateMenuInput } from './menuValidation.js';
import { isInPast } from '../utils/hutTime.js';
import {
  EXPECTED,
  invalid,
  invalidFields,
  isMissing,
  isValidDate,
  parsePositiveInt,
  required,
} from '../utils/validation.js';

const ALLOWED_MEALS = ['breakfast', 'lunch', 'aperitivo', 'dinner'];
const MAX_MENU_NAME_LENGTH = 100;

export function createMenuService({ menuDao, slotDao, db, timeZone, now = () => new Date() }) {
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

  /**
   * Professor rule 2: a variant of a reused menu must not shadow an existing
   * menu of the same meal. "Base" → "Base (2)" → "Base (3)" …
   */
  async function resolveUniqueMenuName(exec, mealId, baseName) {
    let candidate = baseName;
    let n = 2;
    while (await menuDao.findByMealAndName(exec, mealId, candidate)) {
      const suffix = ` (${n})`;
      candidate = baseName.slice(0, Math.max(1, MAX_MENU_NAME_LENGTH - suffix.length)) + suffix;
      n += 1;
    }
    return candidate;
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

    async assignMenuToSlot(slotId, { menuId, content, name, saveVariant: saveVariantRaw }) {
      const parsedSlotId = Number(slotId);
      if (!Number.isInteger(parsedSlotId) || parsedSlotId <= 0) {
        throw new ValidationError('Invalid slot ID.', 'VALIDATION_ERROR');
      }

      let saveVariant = false;
      if (saveVariantRaw !== undefined) {
        if (typeof saveVariantRaw !== 'boolean') {
          throw new ValidationError('saveVariant must be a boolean.', 'VALIDATION_ERROR');
        }
        saveVariant = saveVariantRaw;
      }

      const slot = await slotDao.findById(parsedSlotId);
      if (!slot) {
        throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');
      }

      // Professor rule 1: a menu can only be modified/assigned before the slot starts.
      if (isInPast(slot.date, slot.start_time, { timeZone, now: now() })) {
        throw new UnprocessableEntityError(
          'This slot has already started; its menu can no longer be modified.',
          'SLOT_STARTED'
        );
      }

      let resolvedMenuId = null;
      let nameOverride = null;
      let contentOverride = null;
      let effectiveSaved = true;

      if (menuId !== undefined && menuId !== null) {
        const parsedMenuId = Number(menuId);
        const menu = await menuDao.findById(parsedMenuId);
        if (!menu) {
          throw new NotFoundError('Menu not found.', 'MENU_NOT_FOUND');
        }

        // Verify menu meal matches slot meal
        const mealCheck = await db.query('SELECT meal_type AS "mealType" FROM meals WHERE id = $1', [menu.mealId]);
        if (mealCheck.rows[0]?.mealType !== slot.meal) {
          throw new ValidationError('Menu meal type does not match slot meal type.', 'MEAL_MISMATCH');
        }

        if (content !== undefined || name !== undefined) {
          const validated = validateMenuInput({
            name: name ?? menu.name,
            content: content ?? menu.content,
          });

          if (saveVariant) {
            // Save as a permanent variant in library (menus)
            resolvedMenuId = await db.transaction(async (tx) => {
              const uniqueName = await resolveUniqueMenuName(tx, menu.mealId, validated.name);
              const newMenu = await menuDao.createMenu(tx, {
                mealId: menu.mealId,
                name: uniqueName,
                content: validated.content,
              });
              return newMenu.id;
            });
            effectiveSaved = true;
          } else {
            // Unsaved variant: lives only on the slot overrides
            resolvedMenuId = menu.id;
            nameOverride = validated.name;
            contentOverride = validated.content;
            effectiveSaved = false;
          }
        } else {
          resolvedMenuId = menu.id;
          effectiveSaved = true;
        }
      } else if (content !== undefined && name !== undefined) {
        const resolvedMeal = await db.query('SELECT id FROM meals WHERE meal_type = $1', [slot.meal]);
        const slotMealId = resolvedMeal.rows[0].id;
        const validated = validateMenuInput({ name, content });

        if (saveVariant) {
          resolvedMenuId = await db.transaction(async (tx) => {
            const uniqueName = await resolveUniqueMenuName(tx, slotMealId, validated.name);
            const newMenu = await menuDao.createMenu(tx, {
              mealId: slotMealId,
              name: uniqueName,
              content: validated.content,
            });
            return newMenu.id;
          });
          effectiveSaved = true;
        } else {
          resolvedMenuId = null;
          nameOverride = validated.name;
          contentOverride = validated.content;
          effectiveSaved = false;
        }
      } else {
        throw new ValidationError('Either menuId or valid name and content must be provided for slot assignment.', 'VALIDATION_ERROR');
      }

      await menuDao.assignSlotMenu(parsedSlotId, {
        menuId: resolvedMenuId,
        nameOverride,
        contentOverride,
      });

      return {
        slotId: parsedSlotId,
        menuId: resolvedMenuId,
        saved: effectiveSaved,
        ...(nameOverride ? { name: nameOverride, content: contentOverride } : {}),
        success: true,
      };
    },

    /**
     * Professor rule 3: a menu can be deleted only while none of its
     * referencing slots has already started. Past slots keep their menu.
     * Future slots are released (slots.menu_id → NULL via ON DELETE SET NULL).
     */
    async deleteMenu(menuIdRaw) {
      const menuId = parsePositiveInt(menuIdRaw);
      if (menuId === null) {
        throw invalidFields([invalid('menuId', EXPECTED.positiveInt)]);
      }

      const menu = await menuDao.findById(menuId);
      if (!menu) {
        throw new NotFoundError('Menu not found.', 'MENU_NOT_FOUND');
      }

      const slots = await menuDao.listSlotsReferencingMenu(menuId);
      const hasPastSlot = slots.some((s) =>
        isInPast(s.date, s.start_time, { timeZone, now: now() })
      );
      if (hasPastSlot) {
        throw new ConflictError(
          'This menu is still used by a past slot; past slots keep their assigned menu.',
          'MENU_USED_BY_PAST_SLOT'
        );
      }

      await db.transaction(async (tx) => {
        await menuDao.deleteMenu(tx, menuId);
      });
    },

    /**
     * MH-10-04 (public, read-only): active slots of a day with their assigned
     * menu. `menu` is null when the slot has none — the client can tell "no
     * menu" (200 + null) apart from an error (400/404).
     */
    async publicSlotMenus(query = {}) {
      const details = [];
      const date = query.date;
      if (isMissing(date)) {
        details.push(required('date'));
      } else if (!isValidDate(date)) {
        details.push(invalid('date', EXPECTED.date));
      }
      const meal = query.meal;
      if (!isMissing(meal) && !ALLOWED_MEALS.includes(meal)) {
        details.push(invalid('meal', `one of ${ALLOWED_MEALS.join(', ')}`));
      }
      if (details.length > 0) {
        throw invalidFields(details);
      }

      const rows = await menuDao.listSlotMenus(date, meal ?? null);
      const slots = rows.map((row) => ({
        slotId: row.slotId,
        date: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
        meal: row.meal,
        menu: row.menuNameOverride
          ? { id: row.menuId ?? null, name: row.menuNameOverride, content: row.menuContentOverride, saved: false }
          : row.menuId
            ? { id: row.menuId, name: row.menuName, content: row.menuContent, saved: true }
            : null,
      }));

      return { date, meal: meal ?? null, slots };
    },

    /**
     * MH-10-04 (public, read-only): the menu assigned to one slot.
     * Unknown or archived slot → 404; slot without menu → 200 with menu: null.
     */
    async publicSlotMenu(slotIdRaw) {
      const slotId = parsePositiveInt(slotIdRaw);
      if (slotId === null) {
        throw invalidFields([invalid('slotId', EXPECTED.positiveInt)]);
      }

      const row = await menuDao.findBySlotId(slotId);
      if (!row) {
        throw new NotFoundError('Slot not found.', 'SLOT_NOT_FOUND');
      }

      return {
        slotId: row.slotId,
        date: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
        meal: row.meal,
        menu: row.menuNameOverride
          ? { id: row.menuId ?? null, name: row.menuNameOverride, content: row.menuContentOverride, saved: false }
          : row.menuId
            ? { id: row.menuId, name: row.menuName, content: row.menuContent, saved: true }
            : null,
      };
    },
  };
}
