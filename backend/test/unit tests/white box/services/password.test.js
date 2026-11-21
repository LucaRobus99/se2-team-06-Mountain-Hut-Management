import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import { 
  hashPassword, 
  isPasswordHash, 
  verifyPassword, 
  generateTemporaryPassword, 
  hashToken 
} from '../../../../src/services/password.js';

describe('password - White-Box Tests', () => {

  describe('hashPassword internal branches', () => {
    it('should throw TypeError when password is not a string (e.g. number, object, undefined)', () => {
      expect(() => hashPassword(undefined)).toThrow(TypeError);
      expect(() => hashPassword(12345)).toThrow(TypeError);
      expect(() => hashPassword({})).toThrow(TypeError);
    });

    it('should throw TypeError when password is an empty string', () => {
      expect(() => hashPassword('')).toThrow(TypeError);
    });

    it('should use crypto.randomBytes and scryptSync with correct configuration', () => {
      const spyRandomBytes = vi.spyOn(crypto, 'randomBytes');
      const spyScrypt = vi.spyOn(crypto, 'scryptSync');

      const password = 'SecretPassword123';
      const hash = hashPassword(password);

      expect(spyRandomBytes).toHaveBeenCalledWith(16); // SALT_BYTES = 16
      expect(spyScrypt).toHaveBeenCalledWith(
        password,
        expect.any(String),
        64, // KEY_LENGTH = 64
        { N: 16384, r: 8, p: 1 } // SCRYPT_OPTIONS
      );

      expect(hash.startsWith('scrypt$')).toBe(true);
      spyRandomBytes.mockRestore();
      spyScrypt.mockRestore();
    });
  });

  describe('isPasswordHash regex and type checking', () => {
    it('should return false for non-string types or strings not matching HASH_PATTERN', () => {
      expect(isPasswordHash(null)).toBe(false);
      expect(isPasswordHash(12345)).toBe(false);
      expect(isPasswordHash('scrypt$shortsalt$hash')).toBe(false); // Salt length != 32 hex chars
      expect(isPasswordHash('plain-text-string')).toBe(false);
    });
  });

  describe('verifyPassword try...catch and timingSafeEqual branches', () => {
    it('should return false if stored hash fails isPasswordHash validation', () => {
      expect(verifyPassword('invalid-hash-format', 'mypassword')).toBe(false);
    });

    it('should return false if input password is not a string', () => {
      const hash = hashPassword('mypassword');
      expect(verifyPassword(hash, null)).toBe(false);
      expect(verifyPassword(hash, 9999)).toBe(false);
    });

    it('should catch internal errors (e.g. corrupted hash structure during split/parsing) and return false', () => {
      // Un hash che passa la regex formale ma causa problemi nel parsing o nel buffer
      const corruptedHash = 'scrypt$0123456789abcdef0123456789abcdef$invalidhexlengthcorrupted';
      expect(verifyPassword(corruptedHash, 'password')).toBe(false);
    });
  });

  describe('generateTemporaryPassword limits and randomness', () => {
    it('should throw RangeError if length is less than 8 or greater than 64', () => {
      expect(() => generateTemporaryPassword(7)).toThrow(RangeError);
      expect(() => generateTemporaryPassword(65)).toThrow(RangeError);
    });

    it('should throw RangeError if length is not a valid integer', () => {
      expect(() => generateTemporaryPassword(10.5)).toThrow(RangeError);
      expect(() => generateTemporaryPassword('14')).toThrow(RangeError);
    });

    it('should use crypto.randomInt to select characters from TEMPORARY_PASSWORD_ALPHABET', () => {
      const spyRandomInt = vi.spyOn(crypto, 'randomInt');
      const tempPw = generateTemporaryPassword(10);

      expect(spyRandomInt).toHaveBeenCalledTimes(10);
      expect(tempPw.length).toBe(10);

      spyRandomInt.mockRestore();
    });
  });

  describe('hashToken transformation branch', () => {
    it('should properly convert token to string and compute sha256 hex digest', () => {
      const spyCreateHash = vi.spyOn(crypto, 'createHash');
      
      const token = 123456; // Non-string passed
      const hashed = hashToken(token);

      expect(spyCreateHash).toHaveBeenCalledWith('sha256');
      expect(typeof hashed).toBe('string');
      expect(hashed.length).toBe(64);

      spyCreateHash.mockRestore();
    });
  });

});