import { createExecutorOf } from './executor.js';

/**
 * DAO for MH-07 password reset tokens.
 *
 * Only the SHA-256 hash of the token is stored. A token is valid while
 * `used_at` is NULL and `expires_at` (ISO-8601 UTC, same text format as
 * `created_at`) is still in the future. Methods take an optional executor
 * first, like the other DAOs.
 */
export function createPasswordResetDao(db) {
  const executorOf = createExecutorOf(db);

  return {
    /** Invalidate every previous token for the user, then store the new hash. */
    async replaceForUser(...args) {
      const { db: exec, args: a } = executorOf(args);
      const [userId, tokenHash, expiresAt] = a;
      await exec.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
      await exec.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt]
      );
    },

    async findValidByHash(...args) {
      const { db: exec, args: a } = executorOf(args);
      const [tokenHash, nowIso] = a;
      const { rows } = await exec.query(
        `SELECT id, user_id, token_hash, expires_at, used_at, created_at
         FROM password_reset_tokens
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2
         ORDER BY id DESC
         LIMIT 1`,
        [tokenHash, nowIso]
      );
      return rows[0] ?? null;
    },

    async markUsed(...args) {
      const { db: exec, args: a } = executorOf(args);
      const [tokenId, usedAt] = a;
      await exec.query(
        'UPDATE password_reset_tokens SET used_at = $2 WHERE id = $1',
        [tokenId, usedAt]
      );
    },

    async deleteForUser(...args) {
      const { db: exec, args: a } = executorOf(args);
      await exec.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [a[0]]);
    },
  };
}
