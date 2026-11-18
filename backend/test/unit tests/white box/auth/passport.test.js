import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configurePassport, sanitizeUser } from '../../../../src/auth/passport.js';
import { verifyPassword } from '../../../../src/services/password.js';

// Mock the password verification utility
vi.mock('../../../../src/services/password.js', () => ({
  verifyPassword: vi.fn(),
}));

describe('passport - White-Box Tests (Maximum Coverage)', () => {
  let userDao;
  let passportInstance;

  beforeEach(() => {
    vi.clearAllMocks();

    userDao = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
    };

    passportInstance = configurePassport({ userDao });
  });

  describe('configurePassport - Local Strategy verification callback (White-Box)', () => {

    it('should successfully authenticate user when credentials are valid, trimming email whitespace', async () => {
      const mockUser = {
        id: 10,
        email: 'test@hut.test',
        name: 'Test User',
        role: 'hiker',
        phone: '12345',
        password_hash: 'valid_hash',
      };

      userDao.findByEmail.mockResolvedValue(mockUser);
      verifyPassword.mockReturnValue(true);

      const localStrategy = passportInstance._strategies['local'];
      expect(localStrategy).toBeDefined();

      const done = vi.fn();
      await localStrategy._verify('  test@hut.test   ', 'CorrectPassword123!', done);

      expect(userDao.findByEmail).toHaveBeenCalledWith('test@hut.test');
      expect(verifyPassword).toHaveBeenCalledWith('valid_hash', 'CorrectPassword123!');
      expect(done).toHaveBeenCalledWith(null, {
        id: 10,
        email: 'test@hut.test',
        displayName: 'Test User',
        role: 'hiker',
        phone: '12345',
      });
    });

    it('should fail authentication if user is not found by email (null return)', async () => {
      userDao.findByEmail.mockResolvedValue(null);

      const localStrategy = passportInstance._strategies['local'];
      const done = vi.fn();

      await localStrategy._verify('unknown@hut.test', 'password', done);

      expect(done).toHaveBeenCalledWith(null, false, { message: 'Invalid email or password.' });
    });

    it('should fail authentication if password verification fails', async () => {
      const mockUser = { id: 10, email: 'test@hut.test', password_hash: 'hash' };
      userDao.findByEmail.mockResolvedValue(mockUser);
      verifyPassword.mockReturnValue(false);

      const localStrategy = passportInstance._strategies['local'];
      const done = vi.fn();

      await localStrategy._verify('test@hut.test', 'WrongPassword', done);

      expect(done).toHaveBeenCalledWith(null, false, { message: 'Invalid email or password.' });
    });

    it('should handle and pass errors to done callback if DAO throws during lookup', async () => {
      const dbError = new Error('Database connection failed');
      userDao.findByEmail.mockRejectedValue(dbError);

      const localStrategy = passportInstance._strategies['local'];
      const done = vi.fn();

      await localStrategy._verify('test@hut.test', 'password', done);

      expect(done).toHaveBeenCalledWith(dbError);
    });

  });

  describe('configurePassport - Session Serialization & Deserialization (White-Box)', () => {

    it('should serialize user ID into session correctly', async () => {
      const user = { id: 42, email: 'user@hut.test' };

      await new Promise((resolve) => {
        passportInstance.serializeUser(user, (err, id) => {
          expect(err).toBeNull();
          expect(id).toBe(42);
          resolve();
        });
      });
    });

    it('should deserialize user by ID from session successfully including complex optional sanitizations', async () => {
      const mockRichUser = {
        id: 42,
        email: 'user@hut.test',
        name: 'Serialized Rich User',
        role: 'staff',
        phone: '+393330000000',
        notes: undefined, // Exercises hasOwnProperty branch with falsy/undefined values
        emergency_contact: '112',
        avatar_mime: 'image/png',
        // avatar_version omitted intentionally to test `Number(user.avatar_version) || 0` fallback to 0
        password_change_required: true,
      };
      userDao.findById.mockResolvedValue(mockRichUser);

      await new Promise((resolve) => {
        passportInstance.deserializeUser(42, (err, user) => {
          expect(err).toBeNull();
          expect(userDao.findById).toHaveBeenCalledWith(42);
          expect(user).toEqual({
            id: 42,
            email: 'user@hut.test',
            displayName: 'Serialized Rich User',
            role: 'staff',
            phone: '+393330000000',
            notes: null,
            emergencyContact: '112',
            avatarUrl: '/api/auth/avatar?v=0',
            passwordChangeRequired: true,
          });
          resolve();
        });
      });
    });

    it('should return false during deserialization if user is no longer found in DB', async () => {
      userDao.findById.mockResolvedValue(null);

      await new Promise((resolve) => {
        passportInstance.deserializeUser(999, (err, user) => {
          expect(err).toBeNull();
          expect(user).toBe(false);
          resolve();
        });
      });
    });

    it('should handle errors during deserialization if DAO throws', async () => {
      const dbError = new Error('Query error during deserialization');
      userDao.findById.mockRejectedValue(dbError);

      await new Promise((resolve) => {
        passportInstance.deserializeUser(42, (err, user) => {
          expect(err).toBe(dbError);
          expect(user).toBeUndefined();
          resolve();
        });
      });
    });

  });

  describe('sanitizeUser - Deep White-Box Property Checks', () => {
    
    it('should omit notes and emergency_contact if properties are entirely absent from raw user object', () => {
      const minimalUser = {
        id: 99,
        email: 'min@hut.test',
        name: 'Minimal User',
        role: 'hiker',
      };

      const result = sanitizeUser(minimalUser);
      expect(result).not.toHaveProperty('notes');
      expect(result).not.toHaveProperty('emergencyContact');
      expect(result).not.toHaveProperty('avatarUrl');
      expect(result).not.toHaveProperty('passwordChangeRequired');
    });

  });

});