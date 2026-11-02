import { describe, it, expect } from 'vitest';
import { hashPassword, isPasswordHash, verifyPassword } from '../../../src/services/password.js'; // Sostituisci con il percorso corretto

describe('password - Black-Box Tests', () => {

  describe('hashPassword', () => {
    
    it('should generate a valid scrypt hash string for a non-empty password', () => {
      const password = 'MySecurePassword123!';
      const hash = hashPassword(password);

      expect(typeof hash).toBe('string');
      expect(hash.startsWith('scrypt$')).toBe(true);
      // Format: scrypt$<salt_hex>$<hash_hex>
      const parts = hash.split('$');
      expect(parts.length).toBe(3);
      expect(parts[1].length).toBe(32);  // 16 bytes in hex = 32 chars
      expect(parts[2].length).toBe(128); // 64 bytes in hex = 128 chars
    });

    it('should throw a TypeError if the password is not a string or is empty', () => {
      expect(() => hashPassword('')).toThrow(TypeError);
      expect(() => hashPassword(null)).toThrow(TypeError);
      expect(() => hashPassword(12345)).toThrow(TypeError);
    });

  });

  describe('isPasswordHash', () => {
    
    it('should return true for a correctly formatted scrypt hash', () => {
      const hash = hashPassword('testpassword');
      expect(isPasswordHash(hash)).toBe(true);
    });

    it('should return false for strings that do not match the scrypt hash format', () => {
      expect(isPasswordHash('plainpassword')).toBe(false);
      expect(isPasswordHash('scrypt$short$hash')).toBe(false);
      expect(isPasswordHash(null)).toBe(false);
      expect(isPasswordHash(12345)).toBe(false);
    });

  });

  describe('verifyPassword', () => {
    
    it('should return true when verifying the correct plaintext password against its hash', () => {
      const password = 'CorrectHorseBatteryStaple';
      const hash = hashPassword(password);

      expect(verifyPassword(hash, password)).toBe(true);
    });

    it('should return false when verifying an incorrect plaintext password', () => {
      const password = 'CorrectPassword';
      const wrongPassword = 'WrongPassword';
      const hash = hashPassword(password);

      expect(verifyPassword(hash, wrongPassword)).toBe(false);
    });

    it('should return false if the stored hash format is invalid or corrupted', () => {
      expect(verifyPassword('not-a-hash', 'somepassword')).toBe(false);
      expect(verifyPassword(null, 'somepassword')).toBe(false);
    });

    it('should return false if the input password is not a string', () => {
      const hash = hashPassword('mypassword');
      expect(verifyPassword(hash, null)).toBe(false);
      expect(verifyPassword(hash, 12345)).toBe(false);
    });

  });

});