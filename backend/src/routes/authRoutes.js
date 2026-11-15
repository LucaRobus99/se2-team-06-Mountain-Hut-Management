import { Router } from 'express';
import { UnauthorizedError } from '../errors/AppError.js';
import { validateLogin } from '../auth/loginValidation.js';
import { invalidFields } from '../utils/validation.js';
import { clearSessionCookie } from '../auth/session.js';
import { sanitizeUser } from '../auth/passport.js';
import { NotFoundError } from '../errors/AppError.js';

export function createAuthRouter({
  passport,
  requireAuth,
  registrationService,
  accountService,
  passwordResetService = null,
  now = () => new Date(),
}) {
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

  /**
   * MH-07 / #44: request a password reset link. Public, and always answered
   * with 204 so the endpoint cannot be used to discover registered emails.
   */
  router.post('/forgot-password', async (req, res, next) => {
    try {
      if (!passwordResetService) {
        throw new NotFoundError('Password recovery is not available.', 'NOT_IMPLEMENTED');
      }
      await passwordResetService.request(req.body?.email);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  /** MH-07 / #44: set a new password using a single-use, 24-hour reset token. */
  router.post('/reset-password', async (req, res, next) => {
    try {
      if (!passwordResetService) {
        throw new NotFoundError('Password recovery is not available.', 'NOT_IMPLEMENTED');
      }
      await passwordResetService.reset(req.body?.token, req.body?.newPassword);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /api/auth/me – edit only the current hiker's own contact profile. */
  router.patch('/me', requireAuth(['hiker']), async (req, res, next) => {
    try {
      const updated = await accountService.updateProfile(req.user.id, req.body);
      res.json({ user: sanitizeUser(updated) });
    } catch (err) { next(err); }
  });

  /** POST /api/auth/change-password – verify the old password before updating. */
  router.post('/change-password', requireAuth(), async (req, res, next) => {
    try {
      await accountService.changePassword(req.user.id, req.body);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  /** GET /api/auth/avatar – serves only the authenticated account's image. */
  router.get('/avatar', requireAuth(), async (req, res, next) => {
    try {
      const avatar = await accountService.getAvatar(req.user.id);
      if (!avatar?.avatar_blob || !avatar.avatar_mime) {
        throw new NotFoundError('No profile photo.', 'AVATAR_NOT_FOUND');
      }
      res.set('Cache-Control', 'private, no-store');
      res.set('X-Content-Type-Options', 'nosniff');
      res.type(avatar.avatar_mime).send(Buffer.from(avatar.avatar_blob));
    } catch (err) { next(err); }
  });

  router.patch('/avatar', requireAuth(['hiker']), async (req, res, next) => {
    try {
      const updated = await accountService.uploadAvatar(req.user.id, req.body);
      res.json({ user: sanitizeUser(updated) });
    } catch (err) { next(err); }
  });

  router.delete('/avatar', requireAuth(['hiker']), async (req, res, next) => {
    try {
      const updated = await accountService.removeAvatar(req.user.id);
      res.json({ user: sanitizeUser(updated) });
    } catch (err) { next(err); }
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
