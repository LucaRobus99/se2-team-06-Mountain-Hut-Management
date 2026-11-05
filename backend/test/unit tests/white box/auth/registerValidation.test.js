import { describe, it, expect } from 'vitest';
import { validateRegistration } from '../../../../src/auth/registerValidation.js';

describe('registerValidation - White-Box Tests', () => {

  describe('Internal validation rules and boundary lengths', () => {

    it('should trigger too_long rule if name exceeds 100 characters', () => {
      const longName = 'a'.repeat(101);
      const body = {
        name: longName,
        email: 'test@example.com',
        phone: '+393331234567',
        password: 'Password123!',
      };

      const errors = validateRegistration(body);
      const nameError = errors.find(e => e.field === 'name');

      expect(nameError).toBeDefined();
      expect(nameError.rule).toBe('too_long');
    });

    it('should trigger too_long rule if email exceeds 255 characters', () => {
      const longEmailLocal = 'a'.repeat(250);
      const body = {
        name: 'Valid Name',
        email: `${longEmailLocal}@ex.com`, // > 255 chars
        phone: '+393331234567',
        password: 'Password123!',
      };

      const errors = validateRegistration(body);
      const emailError = errors.find(e => e.field === 'email');

      expect(emailError).toBeDefined();
      expect(emailError.rule).toBe('too_long');
    });

    it('should trigger too_long rule if notes exceed 1000 characters', () => {
      const longNotes = 'x'.repeat(1001);
      const body = {
        name: 'Mario Rossi',
        email: 'mario@example.com',
        phone: '+393331234567',
        password: 'Password123!',
        notes: longNotes,
      };

      const errors = validateRegistration(body);
      const notesError = errors.find(e => e.field === 'notes');

      expect(notesError).toBeDefined();
      expect(notesError.rule).toBe('too_long');
    });

    it('should handle optional fields like notes and emergencyContact when missing without error', () => {
      const body = {
        name: 'Mario Rossi',
        email: 'mario@example.com',
        phone: '+393331234567',
        password: 'Password123!',
      };

      const errors = validateRegistration(body);
      expect(errors).toHaveLength(0);
    });

  });

});