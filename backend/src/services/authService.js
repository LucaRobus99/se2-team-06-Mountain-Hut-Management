import crypto from 'node:crypto';
import { UnauthorizedError, ValidationError, ForbiddenError } from '../errors/AppError.js';
import { verifyPassword } from './password.js';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.name,
    role: user.role,
  };
}

function validateLogin(body) {
  const details = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    details.push({ field: 'body', rule: 'invalid', message: 'Request body must be an object.' });
    return details;
  }
  const allowed = ['email', 'password'];
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      details.push({ field: key, rule: 'unknown', message: `${key} is not allowed.` });
    }
  }
  const email = body.email;
  if (email === undefined || email === null) {
    details.push({ field: 'email', rule: 'required', message: 'email is required.' });
  } else if (typeof email !== 'string' || email.trim() === '') {
    details.push({ field: 'email', rule: 'invalid', message: 'email is invalid.' });
  }
  const password = body.password;
  if (password === undefined || password === null) {
    details.push({ field: 'password', rule: 'required', message: 'password is required.' });
  } else if (typeof password !== 'string' || password === '') {
    details.push({ field: 'password', rule: 'invalid', message: 'password is invalid.' });
  }
  return details;
}

export function createAuthService({ userDao, sessions }) {
  /** Resolves the session cookie to an allowed user (hiker/employee). */
  async function resolveSession(sid) {
    if (!sid) throw new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED');
    const session = sessions.get(sid);
    if (!session) throw new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED');
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(sid);
      throw new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED');
    }
    const user = await userDao.findById(session.userId);
    if (!user) {
      sessions.delete(sid);
      throw new UnauthorizedError('Authentication required.', 'UNAUTHENTICATED');
    }
    if (!['hiker', 'employee'].includes(user.role)) {
      throw new ForbiddenError('Forbidden.', 'FORBIDDEN');
    }
    return user;
  }

  return {
    async login(body) {
      const details = validateLogin(body);
      if (details.length > 0) {
        throw new ValidationError('The request contains invalid fields.', 'VALIDATION_ERROR', details);
      }

      const email = body.email.trim();
      const password = body.password;
      const user = await userDao.findByEmail(email);
      if (!user || !verifyPassword(user.password_hash, password)) {
        throw new UnauthorizedError('Invalid email or password.', 'INVALID_CREDENTIALS');
      }

      const sid = crypto.randomUUID();
      sessions.set(sid, { userId: user.id, createdAt: Date.now() });

      return { sid, user: sanitizeUser(user) };
    },

    async getCurrentUser(sid) {
      return sanitizeUser(await resolveSession(sid));
    },

    async logout(sid) {
      // Expired sessions are rejected like missing ones, then destroyed.
      await resolveSession(sid);
      sessions.delete(sid);
    },
  };
}