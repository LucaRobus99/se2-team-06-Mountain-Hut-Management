import { describe, it, expect, beforeEach, vi } from 'vitest';
import { login, getCurrentUser, logout, registerHiker, updateMyProfile, changeMyPassword } from '../../../../src/api/auth.js';

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

    it('should rethrow unexpected errors during getCurrentUser', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'DB Down' } })
      }));

      await expect(getCurrentUser()).rejects.toThrow('DB Down');
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

    it('should throw unexpected errors during logout (other than 401)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } })
      }));

      await expect(logout()).rejects.toThrow('Server error');
    });

  });

  describe('registerHiker', () => {

    it('should successfully register a new hiker and return user data', async () => {
      const mockNewUser = { id: 2, email: 'newhiker@hut.test', role: 'hiker' };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ user: mockNewUser })
      }));

      const newHikerData = {
        name: 'New Hiker',
        email: 'newhiker@hut.test',
        password: 'Password123!',
        phone: '+393331234567'
      };

      const user = await registerHiker(newHikerData);

      expect(user).toEqual(mockNewUser);
      expect(fetch).toHaveBeenCalledTimes(1);
      
      const [url, options] = fetch.mock.calls[0];
      expect(url).toBe('/api/auth/register');
      expect(options.method).toBe('POST');
      expect(options.credentials).toBe('include');
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
      // Parse the JSON body to compare object keys independently of string serialization order
      expect(JSON.parse(options.body)).toEqual(newHikerData);
    });

    it('should map EMAIL_ALREADY_REGISTERED error code to a friendly message during registration', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'Email in use' } })
      }));

      const duplicateUser = {
        name: 'Duplicate',
        email: 'existing@hut.test',
        password: 'Password123!',
        phone: '+393331234567'
      };

      await expect(registerHiker(duplicateUser))
        .rejects.toThrow('This email already has an account. Please log in instead.');
    });

  });

  describe('updateMyProfile', () => {
    it('should successfully update profile and return updated user data', async () => {
      const mockUpdatedUser = { id: 1, name: 'Mario Updated', phone: '+393339999999' };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ user: mockUpdatedUser })
      }));

      const profileData = { name: 'Mario Updated', phone: '+393339999999' };
      const result = await updateMyProfile(profileData);

      expect(result).toEqual(mockUpdatedUser);
      expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      }));
    });
  });

  describe('changeMyPassword', () => {
    it('should successfully change password', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => null
      }));

      const passData = { currentPassword: 'OldPass', newPassword: 'NewPass123!' };
      await expect(changeMyPassword(passData)).resolves.toBeNull();

      expect(fetch).toHaveBeenCalledWith('/api/auth/change-password', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passData)
      }));
    });
  });

  describe('request helper fallbacks', () => {
    it('should use default error message if error body lacks a message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: {} })
      }));

      await expect(login({ email: 'test@hut.test', password: 'pwd' }))
        .rejects.toThrow('The request could not be completed.');
    });
  });

});