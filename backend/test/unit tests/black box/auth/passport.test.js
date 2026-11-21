import { describe, it, expect, vi } from 'vitest';
import { sanitizeUser, configurePassport } from '../../../../src/auth/passport.js';
import { verifyPassword } from '../../../../src/services/password.js';

// Mock password service at the top level module scope
vi.mock('../../../../src/services/password.js', () => ({
  verifyPassword: vi.fn(),
}));

describe('passport - Black-Box and White-Box Tests', () => {

  describe('sanitizeUser', () => {
    
    it('should correctly sanitize a raw user object into the client-facing shape, hiding sensitive fields', () => {
      const rawUser = {
        id: 1,
        email: 'hiker@hut.test',
        name: 'Mario Rossi',
        role: 'hiker',
        phone: '+393331234567',
        password_hash: 'scrypt$salt$hash',
        created_at: '2026-01-01',
      };

      const result = sanitizeUser(rawUser);

      expect(result).toEqual({
        id: 1,
        email: 'hiker@hut.test',
        displayName: 'Mario Rossi',
        role: 'hiker',
        phone: '+393331234567',
      });
      expect(result.password_hash).toBeUndefined();
      expect(result.created_at).toBeUndefined();
    });

    it('should default phone to null if phone is missing or undefined in the raw user object', () => {
      const rawUser = {
        id: 2,
        email: 'nophone@hut.test',
        name: 'Luigi Verdi',
        role: 'hiker',
        phone: undefined,
      };

      const result = sanitizeUser(rawUser);
      expect(result.phone).toBeNull();
    });

    it('should correctly include notes and emergency_contact if present in the raw user object', () => {
      const rawUser = {
        id: 3,
        email: 'notes@hut.test',
        name: 'Anna Neri',
        role: 'hiker',
        phone: '+393331112233',
        notes: 'Special dietary requirements',
        emergency_contact: '+393339998877',
      };

      const result = sanitizeUser(rawUser);
      expect(result.notes).toBe('Special dietary requirements');
      expect(result.emergencyContact).toBe('+393339998877');
    });

    it('should default notes and emergency_contact to null if they are undefined but keys exist', () => {
      const rawUser = {
        id: 4,
        email: 'nulls@hut.test',
        name: 'Test User',
        role: 'hiker',
        notes: undefined,
        emergency_contact: undefined,
      };

      const result = sanitizeUser(rawUser);
      expect(result.notes).toBeNull();
      expect(result.emergencyContact).toBeNull();
    });

    it('should correctly format avatarUrl if avatar_mime is present', () => {
      const rawUser = {
        id: 5,
        email: 'avatar@hut.test',
        name: 'Avatar User',
        role: 'hiker',
        avatar_mime: 'image/png',
        avatar_version: 3,
      };

      const result = sanitizeUser(rawUser);
      expect(result.avatarUrl).toBe('/api/auth/avatar?v=3');
    });

    it('should set avatarUrl to null if avatar_mime is missing or falsy', () => {
      const rawUser = {
        id: 6,
        email: 'noavatar@hut.test',
        name: 'No Avatar',
        role: 'hiker',
        avatar_mime: null,
      };

      const result = sanitizeUser(rawUser);
      expect(result.avatarUrl).toBeNull();
    });

    it('should include passwordChangeRequired property only when password_change_required is true', () => {
      const rawUserWithFlag = {
        id: 7,
        email: 'changepass@hut.test',
        name: 'Staff Temp',
        role: 'staff',
        password_change_required: true,
      };

      const result = sanitizeUser(rawUserWithFlag);
      expect(result.passwordChangeRequired).toBe(true);

      const rawUserWithoutFlag = {
        id: 8,
        email: 'normal@hut.test',
        name: 'Staff Normal',
        role: 'staff',
        password_change_required: false,
      };

      const resultNormal = sanitizeUser(rawUserWithoutFlag);
      expect(resultNormal.passwordChangeRequired).toBeUndefined();
    });

  });

  describe('configurePassport & Serialization', () => {
    
    it('should correctly instantiate and return a passport instance with userDao configured', () => {
      const userDao = {
        findByEmail: vi.fn(),
        findById: vi.fn(),
      };

      const passportInstance = configurePassport({ userDao });
      expect(passportInstance).toBeDefined();
      expect(typeof passportInstance.use).toBe('function');
      expect(typeof passportInstance.serializeUser).toBe('function');
      expect(typeof passportInstance.deserializeUser).toBe('function');
    });

  });

  describe('LocalStrategy and Session (De)serialization Execution', () => {

    it('should successfully authenticate user with valid credentials in LocalStrategy', async () => {
      const userDao = {
        findByEmail: vi.fn().mockResolvedValue({
          id: 1,
          email: 'hiker@hut.test',
          name: 'Mario Rossi',
          role: 'hiker',
          password_hash: 'hashed_password',
        }),
        findById: vi.fn(),
      };

      // Configure mock verifyPassword to return true for valid password
      verifyPassword.mockReturnValue(true);

      const passport = configurePassport({ userDao });
      
      const strategy = passport._strategy('local');
      expect(strategy).toBeDefined();

      const done = vi.fn();
      await strategy._verify('hiker@hut.test', 'correct_password', done);

      expect(userDao.findByEmail).toHaveBeenCalledWith('hiker@hut.test');
      expect(done).toHaveBeenCalledWith(null, expect.objectContaining({ id: 1, email: 'hiker@hut.test' }));
    });

    it('should fail authentication in LocalStrategy if user is not found or password is invalid', async () => {
      const userDao = {
        findByEmail: vi.fn().mockResolvedValue(null),
        findById: vi.fn(),
      };

      const passport = configurePassport({ userDao });
      const strategy = passport._strategy('local');

      const done = vi.fn();
      await strategy._verify('unknown@hut.test', 'wrong_password', done);

      expect(done).toHaveBeenCalledWith(null, false, { message: 'Invalid email or password.' });
    });

    it('should catch database errors during LocalStrategy verification and pass error to done', async () => {
      const dbError = new Error('Database connection lost');
      const userDao = {
        findByEmail: vi.fn().mockRejectedValue(dbError),
        findById: vi.fn(),
      };

      const passport = configurePassport({ userDao });
      const strategy = passport._strategy('local');

      const done = vi.fn();
      await strategy._verify('hiker@hut.test', 'password', done);

      expect(done).toHaveBeenCalledWith(dbError);
    });

    it('should correctly serialize user into user.id', () => {
      const passport = configurePassport({ userDao: {} });
      const done = vi.fn();

      const serializeFn = passport._serializers[0];
      serializeFn({ id: 42, email: 'test@hut.test' }, done);

      expect(done).toHaveBeenCalledWith(null, 42);
    });

    it('should correctly deserialize user by ID from userDao', async () => {
      const userDao = {
        findById: vi.fn().mockResolvedValue({
          id: 1,
          email: 'hiker@hut.test',
          name: 'Mario Rossi',
          role: 'hiker',
        }),
      };

      const passport = configurePassport({ userDao });
      const done = vi.fn();

      const deserializeFn = passport._deserializers[0];
      await deserializeFn(1, done);

      expect(userDao.findById).toHaveBeenCalledWith(1);
      expect(done).toHaveBeenCalledWith(null, expect.objectContaining({ id: 1, email: 'hiker@hut.test' }));
    });

    it('should return false during deserialization if user is not found in database', async () => {
      const userDao = {
        findById: vi.fn().mockResolvedValue(null),
      };

      const passport = configurePassport({ userDao });
      const done = vi.fn();

      const deserializeFn = passport._deserializers[0];
      await deserializeFn(999, done);

      expect(done).toHaveBeenCalledWith(null, false);
    });

    it('should handle errors during deserialization gracefully', async () => {
      const dbError = new Error('DB error on findById');
      const userDao = {
        findById: vi.fn().mockRejectedValue(dbError),
      };

      const passport = configurePassport({ userDao });
      const done = vi.fn();

      const deserializeFn = passport._deserializers[0];
      await deserializeFn(1, done);

      expect(done).toHaveBeenCalledWith(dbError);
    });

  });

});