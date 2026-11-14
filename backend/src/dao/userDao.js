import { createExecutorOf } from './executor.js';

export function createUserDao(db) {
  const executorOf = createExecutorOf(db);

  return {
    async findByEmail(...args) {
      const { db: exec, args: a } = executorOf(args);
      const email = a[0];
      const { rows } = await exec.query(
        `SELECT id, role, name, email, phone, notes, emergency_contact,
                avatar_mime, avatar_version, password_change_required, password_hash, created_at
         FROM users WHERE lower(email) = lower($1)`,
        [email]
      );
      return rows[0] ?? null;
    },

    async createHiker(...args) {
      const { db: exec, args: a } = executorOf(args);
      const [{ name, email, phone, passwordHash, notes, emergencyContact, passwordChangeRequired = 0 }] = a;
      const { rows } = await exec.query(
        `INSERT INTO users (role, name, email, phone, password_hash, notes, emergency_contact)
         VALUES ('hiker', $1, $2, $3, $4, $5, $6)
         RETURNING id, role, name, email, phone, notes, emergency_contact,
                   avatar_mime, avatar_version, password_change_required, created_at`,
        [name, email, phone, passwordHash, notes, emergencyContact]
      );
      const created = rows[0];

      // Self-registered hikers keep the column default (0). Only accounts
      // created by staff need the first-login password change (MH-07).
      if (passwordChangeRequired) {
        await exec.query('UPDATE users SET password_change_required = 1 WHERE id = $1', [created.id]);
        created.password_change_required = 1;
      }

      return created;
    },

    /**
     * MH-07: every successful password change clears the "must change password"
     * flag, so a staff-created account can use the app after choosing its own
     * password. Accepts an optional transaction executor first.
     */
    async changePassword(...args) {
      const { db: exec, args: a } = executorOf(args);
      const userId = a[0];
      const passwordHash = a[1];
      await exec.query(
        `UPDATE users SET password_hash = $1, password_change_required = 0 WHERE id = $2`,
        [passwordHash, userId]
      );
    },

    async updateProfile(userId, { name, phone, notes, emergencyContact }) {
      await db.query(
        `UPDATE users SET name = $1, phone = $2, notes = $3, emergency_contact = $4 WHERE id = $5`,
        [name, phone, notes, emergencyContact, userId]
      );
      return this.findById(userId);
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
                avatar_mime, avatar_version, password_change_required, password_hash, created_at
         FROM users WHERE id = $1`,
        [id]
      );
      return rows[0] ?? null;
    },

    /**
     * MH-07: staff search for an existing hiker before booking on their behalf.
     * Only the minimal fields needed to pick the right person are returned.
     */
    async searchHikers(term, limit = 20) {
      const text = String(term ?? '').trim().toLowerCase();
      if (!text) return [];

      // Escape LIKE wildcards so a literal _ or % does not match everything.
      const like = `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
      const { rows } = await db.query(
        `SELECT id, name, email, phone
         FROM users
         WHERE role = 'hiker'
           AND (lower(name) LIKE $1 ESCAPE '\\'
             OR lower(email) LIKE $1 ESCAPE '\\'
             OR lower(coalesce(phone, '')) LIKE $1 ESCAPE '\\')
         ORDER BY lower(name), id
         LIMIT $2`,
        [like, limit]
      );
      return rows;
    },
  };
}