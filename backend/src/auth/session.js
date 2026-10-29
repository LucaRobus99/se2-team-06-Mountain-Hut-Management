import session from 'express-session';
import { config } from '../config/config.js';

/** Sessions expire 8 hours after the last authenticated request. */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** Cookie name kept stable so the frontend and the contract do not change. */
export const SESSION_COOKIE_NAME = 'sid';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
  };
}

/**
 * Session middleware. `rolling: true` refreshes the cookie on every response;
 * the server-side `lastAccessAt` check in `requireAuth` enforces the actual
 * 8-hour sliding window, so public requests alone do not keep a session alive.
 *
 * The default MemoryStore is intentional for this single-process MVP: sessions
 * are lost on restart, as documented in the API contract. Use a shared store
 * (e.g. Redis) before running multiple server instances.
 */
export function sessionMiddleware() {
  return session({
    name: SESSION_COOKIE_NAME,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { ...cookieOptions(), maxAge: SESSION_TTL_MS },
  });
}

/** Expires the session cookie immediately (used on logout and session expiry). */
export function clearSessionCookie(res) {
  res.cookie(SESSION_COOKIE_NAME, '', { ...cookieOptions(), maxAge: 0 });
}
