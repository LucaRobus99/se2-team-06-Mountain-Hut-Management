import { UnauthorizedError, ForbiddenError } from '../errors/AppError.js';
import { clearSessionCookie, SESSION_TTL_MS } from '../auth/session.js';

/**
 * Builds the `requireAuth` middleware.
 *
 * `requireAuth()` requires any authenticated user (hiker, employee or warden).
 * `requireAuth(['hiker'])` also enforces the role, returning 403 FORBIDDEN with
 * `forbiddenMessage` (default "Forbidden.").
 * A missing or expired session returns 401 UNAUTHENTICATED.
 *
 * `now` is injectable so the sliding-expiry tests can use a fake clock.
 */
export function createRequireAuth({ now = () => Date.now() } = {}) {
  return function requireAuth(roles = null, forbiddenMessage = 'Forbidden.') {
    return (req, res, next) => {
      if (typeof req.isAuthenticated !== 'function' || !req.isAuthenticated()) {
        return next(new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED'));
      }

      const currentTime = now();
      const lastAccess = req.session?.lastAccessAt ?? req.session?.createdAt;
      if (typeof lastAccess === 'number' && currentTime - lastAccess > SESSION_TTL_MS) {
        return req.session.destroy(() => {
          req.user = null;
          clearSessionCookie(res);
          next(new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED'));
        });
      }

      // A valid authenticated request extends the sliding session window.
      req.session.lastAccessAt = currentTime;

      if (roles && !roles.includes(req.user.role)) {
        return next(new ForbiddenError(forbiddenMessage, 'FORBIDDEN'));
      }

      return next();
    };
  };
}
