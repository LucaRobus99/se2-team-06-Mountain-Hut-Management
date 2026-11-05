import { describe, it, expect } from 'vitest';
import { validateRegistration, validatedRegistration } from '../../../../src/auth/registerValidation.js';

describe('registerValidation - Black-Box Tests', () => {

  describe('validateRegistration', () => {

    it('should return an error if body is missing, null, not an object, or an array', () => {
      const results = [
        validateRegistration(null),
        validateRegistration(undefined),
        validateRegistration('not-an-object'),
        validateRegistration([1, 2, 3]),
      ];

      for (const res of results) {
        expect(res).toHaveLength(1);
        expect(res[0].field).toBe('body');
      }
    });

    it('should pass validation successfully with valid registration data', () => {
      const validBody = {
        name: 'Mario Rossi',
        email: 'mario.rossi@example.com',
        phone: '+39 333 1234567',
        password: 'StrongPassword123!',
        notes: 'Vegetarian meals preferred',
        emergencyContact: 'Jane Doe (+393339999999)',
      };

      const errors = validateRegistration(validBody);
      expect(errors).toHaveLength(0);
    });

    it('should detect required or missing fields (name, email, phone, password)', () => {
      const incompleteBody = {
        notes: 'Just notes',
      };

      const errors = validateRegistration(incompleteBody);
      const fieldsInError = errors.map(e => e.field);

      expect(fieldsInError).toContain('name');
      expect(fieldsInError).toContain('email');
      expect(fieldsInError).toContain('phone');
      expect(fieldsInError).toContain('password');
    });

    it('should flag unknown fields that are not allowed', () => {
      const bodyWithUnknown = {
        name: 'Mario Rossi',
        email: 'mario@example.com',
        phone: '+393331234567',
        password: 'Password123!',
        role: 'admin', // Malicious attempt to inject role
        unauthorizedKey: true,
      };

      const errors = validateRegistration(bodyWithUnknown);
      const unknownErrors = errors.filter(e => e.rule === 'unknown');
      
      expect(unknownErrors).toHaveLength(2);
      expect(unknownErrors.map(e => e.field)).toContain('role');
      expect(unknownErrors.map(e => e.field)).toContain('unauthorizedKey');
    });

    it('should validate email format correctness', () => {
      const body = {
        name: 'Mario Rossi',
        email: 'invalid-email-format',
        phone: '+393331234567',
        password: 'Password123!',
      };

      const errors = validateRegistration(body);
      const emailError = errors.find(e => e.field === 'email');
      expect(emailError).toBeDefined();
    });

    it('should validate phone number format and minimum digits', () => {
      const body = {
        name: 'Mario Rossi',
        email: 'mario@example.com',
        phone: '123', // Too short (< 6 digits)
        password: 'Password123!',
      };

      const errors = validateRegistration(body);
      const phoneError = errors.find(e => e.field === 'phone');
      expect(phoneError).toBeDefined();
    });

    it('should validate password length constraints (between 8 and 128 chars)', () => {
      const bodyShortPass = {
        name: 'Mario Rossi',
        email: 'mario@example.com',
        phone: '+393331234567',
        password: 'short', // < 8 chars
      };

      const errors = validateRegistration(bodyShortPass);
      const passError = errors.find(e => e.field === 'password');
      expect(passError).toBeDefined();
    });

  });

  describe('validatedRegistration (Sanitization and Wrapper)', () => {

    it('should sanitize, trim, and normalize data when valid input is provided', () => {
      const input = {
        name: '  Mario Rossi  ',
        email: '  MARIO.ROSSI@EXAMPLE.COM ',
        phone: ' +393331234567 ',
        password: 'Password123!',
        notes: '  Some notes  ',
        emergencyContact: ' Jane Doe ',
      };

      const sanitized = validatedRegistration(input);

      expect(sanitized).toEqual({
        name: 'Mario Rossi',
        email: 'mario.rossi@example.com',
        phone: '+393331234567',
        password: 'Password123!',
        notes: 'Some notes',
        emergencyContact: 'Jane Doe',
      });
    });

    it('should throw an error if validatedRegistration receives invalid data', () => {
      const invalidInput = { name: '' }; // Missing required fields

      expect(() => validatedRegistration(invalidInput)).toThrow();
    });

  });

});