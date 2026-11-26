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
  };
}
