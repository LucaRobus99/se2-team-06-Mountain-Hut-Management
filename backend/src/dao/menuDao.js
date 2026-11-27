import { createExecutorOf } from './executor.js';

export function createMenuDao(db) {
  const executorOf = createExecutorOf(db);

  return {
    async createMenu(...args) {
      const { db: exec, args: a } = executorOf(args);
      const { mealId, name, content } = a[0];
      const { rows } = await exec.query(
        `INSERT INTO menus (meal_id, name, content, updated_at)
         VALUES ($1, $2, $3, to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
         RETURNING id, meal_id AS "mealId", name, content, updated_at AS "updatedAt"`,
        [mealId, name, content]
      );
      return rows[0];
    },

    async findById(...args) {
      const { db: exec, args: a } = executorOf(args);
      const id = a[0];
      const { rows } = await exec.query(
        `SELECT id, meal_id AS "mealId", name, content, updated_at AS "updatedAt"
         FROM menus
         WHERE id = $1`,
        [id]
      );
      return rows[0] ?? null;
    },

    async findByMealAndName(...args) {
      const { db: exec, args: a } = executorOf(args);
      const [mealId, name] = a;
      const { rows } = await exec.query(
        `SELECT id, meal_id AS "mealId", name, content, updated_at AS "updatedAt"
         FROM menus
         WHERE meal_id = $1 AND name = $2`,
        [mealId, name]
      );
      return rows[0] ?? null;
    },

    async updateMenu(...args) {
      const { db: exec, args: a } = executorOf(args);
      const id = a[0];
      const { name, content } = a[1];
      const { rows } = await exec.query(
        `UPDATE menus
         SET name = COALESCE($2, name),
             content = COALESCE($3, content),
             updated_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
         WHERE id = $1
         RETURNING id, meal_id AS "mealId", name, content, updated_at AS "updatedAt"`,
        [id, name, content]
      );
      return rows[0] ?? null;
    },

    async listByMeal(...args) {
      const { db: exec, args: a } = executorOf(args);
      const mealId = a[0];
      const { rows } = await exec.query(
        `SELECT id, meal_id AS "mealId", name, content, updated_at AS "updatedAt"
         FROM menus
         WHERE meal_id = $1
         ORDER BY name, id`,
        [mealId]
      );
      return rows;
    },

    async listAll(...args) {
      const { db: exec, args: a } = executorOf(args);
      const { rows } = await exec.query(
        `SELECT m.id, m.meal_id AS "mealId", me.meal_type AS "meal", m.name, m.content, m.updated_at AS "updatedAt"
         FROM menus m
         JOIN meals me ON me.id = m.meal_id
         ORDER BY me.id, m.name, m.id`
      );
      return rows;
    },

    /**
     * MH-10-04: active slots of a day with their assigned menu (LEFT JOIN so
     * slots without a menu still show up with null menu columns).
     */
    async listSlotMenus(...args) {
      const { db: exec, args: a } = executorOf(args);
      const [date, mealType] = a;
      const mealFilter = mealType ? 'AND m.meal_type = $2' : '';
      const params = mealType ? [date, mealType] : [date];
      const { rows } = await exec.query(
        `SELECT s.id AS "slotId", s.date, s.start_time AS "startTime", s.end_time AS "endTime",
                m.meal_type AS "meal",
                s.menu_id AS "menuId", mu.name AS "menuName", mu.content AS "menuContent",
                s.menu_name_override AS "menuNameOverride", s.menu_content_override AS "menuContentOverride"
         FROM slots s
         JOIN meals m ON m.id = s.meal_id
         LEFT JOIN menus mu ON mu.id = s.menu_id
         WHERE s.date = $1 AND s.archived_at IS NULL ${mealFilter}
         ORDER BY s.start_time, s.id`,
        params
      );
      return rows;
    },

    /**
     * MH-10-04: one active slot with its meal and (optionally) assigned menu.
     * Returns null when the slot does not exist or is archived.
     */
    async findBySlotId(...args) {
      const { db: exec, args: a } = executorOf(args);
      const slotId = a[0];
      const { rows } = await exec.query(
        `SELECT s.id AS "slotId", s.date, s.start_time AS "startTime", s.end_time AS "endTime",
                m.meal_type AS "meal",
                s.menu_id AS "menuId", mu.name AS "menuName", mu.content AS "menuContent",
                s.menu_name_override AS "menuNameOverride", s.menu_content_override AS "menuContentOverride"
         FROM slots s
         JOIN meals m ON m.id = s.meal_id
         LEFT JOIN menus mu ON mu.id = s.menu_id
         WHERE s.id = $1 AND s.archived_at IS NULL`,
        [slotId]
      );
      return rows[0] ?? null;
    },

    /**
     * MH-10-02/03: set the slot's full menu state in one UPDATE. All three
     * values are written explicitly (NULL included) so re-assigning never
     * leaves stale overrides: library menu → overrides NULL, unsaved variant
     * → name/content override set, base menu_id may be NULL (ad-hoc).
     */
    async assignSlotMenu(...args) {
      const { db: exec, args: a } = executorOf(args);
      const [slotId, { menuId, nameOverride, contentOverride }] = a;
      await exec.query(
        `UPDATE slots
         SET menu_id = $1,
             menu_name_override = $2,
             menu_content_override = $3
         WHERE id = $4`,
        [menuId ?? null, nameOverride ?? null, contentOverride ?? null, slotId]
      );
    },

    async deleteMenu(...args) {
      const { db: exec, args: a } = executorOf(args);
      const id = a[0];
      // slots.menu_id is ON DELETE SET NULL: referencing slots are released.
      await exec.query('DELETE FROM menus WHERE id = $1', [id]);
    },

    /**
     * Every slot still referencing a menu, active or archived: archived rows
     * keep their cancelled-booking history, so their past slots must keep
     * their menu too. Used by the deletion guard (professor rule 3).
     */
    async listSlotsReferencingMenu(...args) {
      const { db: exec, args: a } = executorOf(args);
      const menuId = a[0];
      const { rows } = await exec.query(
        'SELECT id, date, start_time FROM slots WHERE menu_id = $1 ORDER BY date, start_time',
        [menuId]
      );
      return rows;
    },
  };
}
