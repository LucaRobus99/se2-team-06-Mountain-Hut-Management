import { Router } from 'express';
import { UnauthorizedError } from '../errors/AppError.js';
import { validateLogin } from '../auth/loginValidation.js';
import { invalidFields } from '../utils/validation.js';
import { clearSessionCookie } from '../auth/session.js';
import { sanitizeUser } from '../auth/passport.js';

export function createAuthRouter({ passport, requireAuth, registrationService, now = () => new Date() }) {
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

      return startSession(req, user, now, next, (sanitized) => res.status(200).json({ user: sanitized }));
    })(req, res, next);
  });

  /** POST /api/auth/register – public; creates a hiker and signs them in. */
  router.post('/register', async (req, res, next) => {
    try {
      const registered = await registrationService.registerHiker(req.body);
      startSession(req, sanitizeUser(registered), now, next, (user) => res.status(201).json({ user }));
    } catch (err) {
      next(err);
    }
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

/** Regenerate the cookie before authentication to prevent session fixation. */
function startSession(req, user, now, next, respond) {
  req.session.regenerate((regenerateErr) => {
    if (regenerateErr) return next(regenerateErr);
    req.logIn(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      const timestamp = now().getTime();
      req.session.createdAt = timestamp;
      req.session.lastAccessAt = timestamp;
      respond(user);
    });
  });
}
