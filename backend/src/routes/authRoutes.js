import { Router } from 'express';
import { UnauthorizedError } from '../errors/AppError.js';
import { validateLogin } from '../auth/loginValidation.js';
import { invalidFields } from '../utils/validation.js';
import { clearSessionCookie } from '../auth/session.js';

export function createAuthRouter({ passport, requireAuth, now = () => new Date() }) {
  const router = Router();

  /** POST /api/auth/login – public */
  router.post('/login', (req, res, next) => {
    const details = validateLogin(req.body);
    if (details.length > 0) {
      return next(invalidFields(details));
    }

    // `session: false` only verifies the credentials; the session is created
    // explicitly below after regenerating its id (prevents session fixation).
    passport.authenticate('local', { session: false }, (err, user) => {
      if (err) return next(err);
      if (!user) {
        return next(new UnauthorizedError('Invalid email or password.', 'INVALID_CREDENTIALS'));
      }

      return req.session.regenerate((regenerateErr) => {
        if (regenerateErr) return next(regenerateErr);

        return req.logIn(user, (loginErr) => {
          if (loginErr) return next(loginErr);

          const timestamp = now().getTime();
          req.session.createdAt = timestamp;
          req.session.lastAccessAt = timestamp;

          return res.status(200).json({ user });
        });
      });
    })(req, res, next);
  });

  /** GET /api/auth/me – any authenticated role */
  router.get('/me', requireAuth(), (req, res) => {
    res.json({ user: req.user });
  });

  /** POST /api/auth/logout – any authenticated role */
  router.post('/logout', requireAuth(), (req, res, next) => {
    req.logout((logoutErr) => {
      if (logoutErr) return next(logoutErr);

      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        clearSessionCookie(res);
        res.status(204).end();
      });
    });
  });

  return router;
}
