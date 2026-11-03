import { describe, it, expect, vi } from 'vitest';
import { SESSION_TTL_MS, SESSION_COOKIE_NAME, sessionMiddleware, clearSessionCookie } from '../../../../src/auth/session.js';

describe('session - Black-Box Tests', () => {

  it('should export the correct session TTL (8 hours in milliseconds) and stable cookie name', () => {
    expect(SESSION_TTL_MS).toBe(8 * 60 * 60 * 1000);
    expect(SESSION_COOKIE_NAME).toBe('sid');
  });

  it('should return a function when calling sessionMiddleware', () => {
    const middleware = sessionMiddleware();
    expect(typeof middleware).toBe('function');
  });

  it('should call res.cookie with correct parameters to clear the session cookie', () => {
    const res = {
      cookie: vi.fn(),
    };

    clearSessionCookie(res);

    expect(res.cookie).toHaveBeenCalledOnce();
    expect(res.cookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      '',
      expect.objectContaining({
        maxAge: 0,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      })
    );
  });

});