import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequireAuth } from '../../../../src/middleware/requireAuth.js';
import { UnauthorizedError, ForbiddenError } from '../../../../src/errors/AppError.js';
import { SESSION_TTL_MS } from '../../../../src/auth/session.js';

describe('requireAuth Middleware - Unit Tests', () => {
  let req, res, next, requireAuth;
  const mockNow = 1000000000000; 

  beforeEach(() => {
    
    const authFactory = createRequireAuth({ now: () => mockNow });
    requireAuth = (roles) => authFactory(roles);

    req = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      user: { id: 1, role: 'hiker' },
      session: {
        createdAt: mockNow - 1000, 
        lastAccessAt: null,
        destroy: vi.fn((cb) => cb()),
      },
    };

    res = {
      cookie: vi.fn().mockReturnThis(),
    };
    
    next = vi.fn();
  });

  it('should return UnauthorizedError if req.isAuthenticated is missing or returns false', () => {
    req.isAuthenticated.mockReturnValue(false);
    const middleware = requireAuth();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    expect(next.mock.calls[0][0].code).toBe('UNAUTHENTICATED');
  });

  it('should return UnauthorizedError and destroy session if session has expired beyond TTL', () => {
   
    req.session.lastAccessAt = mockNow - SESSION_TTL_MS - 5000;
    const middleware = requireAuth();

    middleware(req, res, next);

    expect(req.session.destroy).toHaveBeenCalled();
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    expect(next.mock.calls[0][0].code).toBe('UNAUTHENTICATED');
  });

  it('should extend the sliding session window and call next() on valid authentication', () => {
    req.session.lastAccessAt = mockNow - 2000; 
    const middleware = requireAuth();

    middleware(req, res, next);

    
    expect(req.session.lastAccessAt).toBe(mockNow);
    expect(next).toHaveBeenCalledWith(); 
  });

  it('should return ForbiddenError if user role is not included in allowed roles', () => {
    req.user.role = 'hiker';
    
    const middleware = requireAuth(['employee', 'warden']);

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
    expect(next.mock.calls[0][0].code).toBe('FORBIDDEN');
  });

  it('should call next() successfully if user role matches allowed roles', () => {
    req.user.role = 'employee';
    const middleware = requireAuth(['employee', 'warden']);

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(); 
  });

  it('should use createdAt as fallback if lastAccessAt is null or undefined when checking session TTL', () => {
    req.session.lastAccessAt = null;
    req.session.createdAt = mockNow - SESSION_TTL_MS - 5000; // Scaduto basandosi su createdAt
    const middleware = requireAuth();

    middleware(req, res, next);

    expect(req.session.destroy).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
  });

  it('should allow a custom forbidden message when ForbiddenError is thrown', () => {
    req.user.role = 'hiker';
    const customMessage = 'Only staff members can access this resource.';
    const authFactory = createRequireAuth({ now: () => mockNow });
    const middleware = authFactory(['warden'], customMessage);

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
    expect(next.mock.calls[0][0].message).toBe(customMessage);
  });
});