import { createExecutorOf } from './executor.js';

export function createUserDao(db) {
  const executorOf = createExecutorOf(db);

  return {
    async findByEmail(...args) {
      const { db: exec, args: a } = executorOf(args);
      const email = a[0];
      const { rows } = await exec.query(
        `SELECT id, role, name, email, phone, notes, emergency_contact,
                avatar_mime, avatar_version, password_hash, created_at
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
         RETURNING id, role, name, email, phone, notes, emergency_contact,
                   avatar_mime, avatar_version, created_at`,
        [name, email, phone, passwordHash, notes, emergencyContact]
      );
      return rows[0];
    },

    async updateProfile(userId, { name, phone, notes, emergencyContact }) {
      await db.query(
        `UPDATE users SET name = $1, phone = $2, notes = $3, emergency_contact = $4 WHERE id = $5`,
        [name, phone, notes, emergencyContact, userId]
      );
      return this.findById(userId);
    },

    async changePassword(userId, passwordHash) {
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    },

    async setAvatar(userId, image, mime) {
      await db.query(
        `UPDATE users SET avatar_blob = $1, avatar_mime = $2, avatar_version = avatar_version + 1 WHERE id = $3`,
        [image, mime, userId]
      );
      return this.findById(userId);
    },

    async getAvatar(userId) {
      const { rows } = await db.query('SELECT avatar_blob, avatar_mime FROM users WHERE id = $1', [userId]);
      return rows[0] ?? null;
    },

    async findById(...args) {
      const { db: exec, args: a } = executorOf(args);
      const id = a[0];
      const { rows } = await exec.query(
        `SELECT id, role, name, email, phone, notes, emergency_contact,
                avatar_mime, avatar_version, password_hash, created_at
         FROM users WHERE id = $1`,
        [id]
      );
      return rows[0] ?? null;
    },
  };
}