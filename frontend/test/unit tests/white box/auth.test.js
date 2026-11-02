import { describe, it, expect, beforeEach, vi } from 'vitest';
import { login, getCurrentUser, logout } from '../../../src/api/auth.js';

describe('Auth API - White-Box Unit Tests', () => {
  
  beforeEach(() => {
    // Clear all mocks before each test
    vi.restoreAllMocks();
  });

  describe('login', () => {
    
    it('should successfully login and return user data on valid credentials', async () => {
      const mockUser = { id: 1, email: 'hiker@hut.test', role: 'hiker' };
      
      // Simulate a successful HTTP 200 response
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ user: mockUser })
      }));

      const user = await login({ email: 'hiker@hut.test', password: 'password' });
      
      expect(user).toEqual(mockUser);
      expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }));
    });

    it('should map INVALID_CREDENTIALS error code to a friendly message', async () => {
      // Simulate an HTTP 401 response with a custom error
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 'INVALID_CREDENTIALS', message: 'Bad credentials' } })
      }));

      await expect(login({ email: 'hiker@hut.test', password: 'wrong' }))
        .rejects.toThrow('Incorrect email or password.');
    });

    it('should throw network error when server is unreachable', async () => {
      // Simulate a network exception (e.g., fetch failure)
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      await expect(login({ email: 'hiker@hut.test', password: 'password' }))
        .rejects.toThrow('Unable to reach the server. Make sure the backend is running.');
    });

  });

  describe('getCurrentUser', () => {
    
    it('should return user data when session is active', async () => {
      const mockUser = { id: 1, email: 'hiker@hut.test', role: 'hiker' };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ user: mockUser })
      }));

      const user = await getCurrentUser();
      
      expect(user).toEqual(mockUser);
      expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.any(Object));
    });

    it('should return null when user is not authenticated (status 401)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 'UNAUTHENTICATED' } })
      }));

      const user = await getCurrentUser();
      
      expect(user).toBeNull();
    });

  });

  describe('logout', () => {
    
    it('should successfully execute logout on status 204', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => null
      }));

      await expect(logout()).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
        method: 'POST'
      }));
    });

    it('should ignore 401 error during logout if session is already expired', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({})
      }));

      // Should not throw errors if 401 is received during logout
      await expect(logout()).resolves.toBeUndefined();
    });

  });

});