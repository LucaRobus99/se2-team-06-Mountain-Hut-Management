import { describe, it, expect, vi } from 'vitest';
import { sessionMiddleware, SESSION_COOKIE_NAME, SESSION_TTL_MS } from '../../../../src/auth/session.js';
import { config } from '../../../../src/config/config.js';

// Mock express-session to inspect the options passed into it
vi.mock('express-session', () => ({
  default: vi.fn((options) => {
    return { _options: options, handle: (req, res, next) => next() };
  }),
}));

describe('session - White-Box Tests', () => {

  it('should configure session middleware with correct internal options, secret, and rolling window', () => {
    const middleware = sessionMiddleware();
    
    // Access internal options captured by the express-session mock
    const options = middleware._options;

    expect(options.name).toBe(SESSION_COOKIE_NAME);
    expect(options.secret).toBe(config.sessionSecret);
    expect(options.resave).toBe(false);
    expect(options.saveUninitialized).toBe(false);
    expect(options.rolling).toBe(true);
    expect(options.cookie.maxAge).toBe(SESSION_TTL_MS);
    expect(options.cookie.httpOnly).toBe(true);
    expect(options.cookie.sameSite).toBe('lax');
    expect(options.cookie.secure).toBe(config.isProduction);
    expect(options.cookie.path).toBe('/');
  });

});