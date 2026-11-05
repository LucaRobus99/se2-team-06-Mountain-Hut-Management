import { describe, it, expect } from 'vitest';
import { sanitizeUser } from '../../../../src/auth/passport.js';

describe('passport - Black-Box Tests', () => {

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

  });

});