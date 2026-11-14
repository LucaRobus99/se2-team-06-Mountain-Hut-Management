import { ForbiddenError } from '../errors/AppError.js';

/**
 * MH-07: while `passwordChangeRequired` is true, only the endpoints needed to
 * complete the change (read the profile, change the password, log out) remain
 * reachable. Every other authenticated request returns 403, as specified.
 * The login / forgot-password / reset-password endpoints are public: they are
 * only reachable without an authenticated flagged session.
 */
export const PASSWORD_CHANGE_ALLOWED_PATHS = new Set([
  '/api/auth/me',
  '/api/auth/change-password',
  '/api/auth/logout',
]);

export function createRequirePasswordChange({ allowedPaths = PASSWORD_CHANGE_ALLOWED_PATHS } = {}) {
  return function requirePasswordChange(req, _res, next) {
    if (typeof req.isAuthenticated !== 'function' || !req.isAuthenticated()) {
      return next();
    }

    if (!req.user?.passwordChangeRequired) {
      return next();
    }

    const path = (req.originalUrl || req.url || '').split('?')[0].replace(/\/+$/, '') || '/';

    if (allowedPaths.has(path)) {
      return next();
    }

    return next(
      new ForbiddenError(
        'You must change your password before continuing.',
        'PASSWORD_CHANGE_REQUIRED'
      )
    );
  };
}
