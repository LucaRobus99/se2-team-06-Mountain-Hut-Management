import crypto from 'node:crypto';
import { ValidationError } from '../errors/AppError.js';
import { EXPECTED, invalid, invalidFields, isValidEmail } from '../utils/validation.js';
import { hashPassword, hashToken } from './password.js';

/** #44: the reset link is valid for 24 hours. */
export const PASSWORD_RESET_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * MH-07 password recovery.
 *
 * - `request` never reveals whether an email belongs to an account: it always
 *   resolves successfully and only sends a message when the account exists.
 * - Only the SHA-256 hash of the token is stored, links are single-use and
 *   expire after 24 hours (#44).
 * - A successful reset clears `passwordChangeRequired`, because the hiker has
 *   just chosen a password of their own.
 */
export function createPasswordResetService({
  db,
  userDao,
  passwordResetDao,
  emailService = null,
  appBaseUrl = 'http://localhost:5173',
  now = () => new Date(),
  tokenTtlMs = PASSWORD_RESET_TTL_MS,
} = {}) {
  function resetUrlFor(token) {
    const base = String(appBaseUrl).replace(/\/+$/, '');
    return `${base}/reset-password?token=${encodeURIComponent(token)}`;
  }

  return {
    async request(emailRaw) {
      const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';

      if (!email || email.length > 255 || !isValidEmail(email)) {
        throw invalidFields([invalid('email', EXPECTED.email)]);
      }

      const user = await userDao.findByEmail(email);

      // Unknown address: do nothing, so accounts cannot be enumerated.
      if (!user) {
        return { requested: true, delivery: { status: 'skipped' } };
      }

      const token = crypto.randomBytes(32).toString('base64url');
      const expiresAt = new Date(now().getTime() + tokenTtlMs).toISOString();

      await passwordResetDao.replaceForUser(user.id, hashToken(token), expiresAt);

      let delivery = { status: 'skipped' };

      if (emailService && typeof emailService.sendPasswordReset === 'function') {
        try {
          const result = await emailService.sendPasswordReset({
            to: user.email,
            name: user.name,
            resetUrl: resetUrlFor(token),
            expiresInHours: Math.round(tokenTtlMs / (60 * 60 * 1000)),
          });
          delivery = { status: result?.skipped ? 'skipped' : 'sent' };
        } catch {
          // Email delivery must not reveal whether the account exists.
          delivery = { status: 'failed' };
        }
      }

      return { requested: true, delivery };
    },

    async reset(tokenRaw, newPasswordRaw) {
      const details = [];

      if (typeof tokenRaw !== 'string' || tokenRaw.trim().length < 16 || tokenRaw.trim().length > 200) {
        details.push(invalid('token', 'a valid reset token'));
      }

      if (typeof newPasswordRaw !== 'string' ||
          newPasswordRaw.length < 8 || newPasswordRaw.length > 128) {
        details.push(invalid('newPassword', 'between 8 and 128 characters'));
      }

      if (details.length) {
        throw invalidFields(details);
      }

      const tokenHash = hashToken(tokenRaw.trim());
      const nowIso = now().toISOString();

      await db.transaction(async (tx) => {
        const stored = await passwordResetDao.findValidByHash(tx, tokenHash, nowIso);

        if (!stored) {
          throw new ValidationError(
            'This password reset link is invalid or has expired.',
            'INVALID_RESET_TOKEN'
          );
        }

        await passwordResetDao.markUsed(tx, stored.id, nowIso);
        await userDao.changePassword(tx, stored.user_id, hashPassword(newPasswordRaw));
        // Any other outstanding link for the same account becomes unusable.
        await passwordResetDao.deleteForUser(tx, stored.user_id);
      });
    },
  };
}
