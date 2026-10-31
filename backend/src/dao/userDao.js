import { createExecutorOf } from './executor.js';

export function createUserDao(db) {
  const executorOf = createExecutorOf(db);

  return {
    async findByEmail(...args) {
      const { db: exec, args: a } = executorOf(args);
      const email = a[0];
      const { rows } = await exec.query(
        `SELECT id, role, name, email, phone, password_hash, created_at
         FROM users WHERE email = $1`,
        [email]
      );
      return rows[0] ?? null;
    },

    async findById(...args) {
      const { db: exec, args: a } = executorOf(args);
      const id = a[0];
      const { rows } = await exec.query(
        `SELECT id, role, name, email, phone, password_hash, created_at
         FROM users WHERE id = $1`,
        [id]
      );
      return rows[0] ?? null;
    },
  };
}