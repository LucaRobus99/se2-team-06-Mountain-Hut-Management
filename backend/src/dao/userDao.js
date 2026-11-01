import { createExecutorOf } from './executor.js';

export function createUserDao(db) {
  const executorOf = createExecutorOf(db);

  return {
    async findByEmail(...args) {
      const { db: exec, args: a } = executorOf(args);
      const email = a[0];
      const { rows } = await exec.query(
        `SELECT id, role, name, email, phone, password_hash, created_at
         FROM users WHERE lower(email) = lower($1)`,
        [email]
      );
      return rows[0] ?? null;
    },

    async createHiker(...args) {
      const { db: exec, args: a } = executorOf(args);
      const [{ name, email, phone, passwordHash, notes, emergencyContact }] = a;
      const { rows } = await exec.query(
        `INSERT INTO users (role, name, email, phone, password_hash, notes, emergency_contact)
         VALUES ('hiker', $1, $2, $3, $4, $5, $6)
         RETURNING id, role, name, email, phone, notes, emergency_contact, created_at`,
        [name, email, phone, passwordHash, notes, emergencyContact]
      );
      return rows[0];
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