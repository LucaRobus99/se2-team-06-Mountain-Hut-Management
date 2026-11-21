import { describe, it, expect, vi } from 'vitest';
import { createRequirePasswordChange, PASSWORD_CHANGE_ALLOWED_PATHS } from '../../../../src/middleware/requirePasswordChange.js';
import { ForbiddenError } from '../../../../src/errors/AppError.js';

describe('requirePasswordChange Middleware - White-Box Tests', () => {

  const middleware = createRequirePasswordChange();

  it('should call next() if the request is unauthenticated (isAuthenticated is false or missing)', () => {
    const req = { isAuthenticated: () => false };
    const res = {};
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // called with no arguments
  });

  it('should call next() if isAuthenticated is not a function', () => {
    const req = { isAuthenticated: undefined };
    const res = {};
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next() if user is authenticated but passwordChangeRequired is falsy or undefined', () => {
    const req = {
      isAuthenticated: () => true,
      user: { id: 1, role: 'hiker', passwordChangeRequired: false },
      originalUrl: '/api/bookings',
    };
    const res = {};
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next() if passwordChangeRequired is true but the path is in allowed paths', () => {
    const allowedUrls = [
      '/api/auth/me',
      '/api/auth/change-password',
      '/api/auth/logout',
      '/api/auth/me/', // with trailing slash
      '/api/auth/me?ref=dashboard', // with query string
    ];

    allowedUrls.forEach((url) => {
      const req = {
        isAuthenticated: () => true,
        user: { id: 1, role: 'staff', passwordChangeRequired: true },
        originalUrl: url,
      };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });
  });

  it('should pass a ForbiddenError to next() if passwordChangeRequired is true and path is not allowed', () => {
    const req = {
      isAuthenticated: () => true,
      user: { id: 1, role: 'staff', passwordChangeRequired: true },
      originalUrl: '/api/bookings/create?foo=bar',
    };
    const res = {};
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const errorArg = next.mock.calls[0][0];
    
    expect(errorArg).toBeInstanceOf(ForbiddenError);
    expect(errorArg.message).toBe('You must change your password before continuing.');
    expect(errorArg.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('should fall back to req.url if req.originalUrl is missing', () => {
    const req = {
      isAuthenticated: () => true,
      user: { id: 1, passwordChangeRequired: true },
      url: '/api/bookings',
    };
    const res = {};
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
  });

  it('should support custom allowedPaths configuration', () => {
    const customMiddleware = createRequirePasswordChange({
      allowedPaths: new Set(['/custom/path']),
    });

    const reqAllowed = {
      isAuthenticated: () => true,
      user: { passwordChangeRequired: true },
      originalUrl: '/custom/path',
    };
    const nextAllowed = vi.fn();
    customMiddleware(reqAllowed, {}, nextAllowed);
    expect(nextAllowed).toHaveBeenCalledWith();

    const reqForbidden = {
      isAuthenticated: () => true,
      user: { passwordChangeRequired: true },
      originalUrl: '/api/auth/me', // default allowed, but custom config overrides it
    };
    const nextForbidden = vi.fn();
    customMiddleware(reqForbidden, {}, nextForbidden);
    expect(nextForbidden.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
  });

});