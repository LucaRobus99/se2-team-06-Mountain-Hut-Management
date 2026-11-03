import { describe, it, expect } from 'vitest';
import { validateLogin } from '../../../../src/auth/loginValidation.js';

describe('loginValidation - White-Box Tests', () => {

  describe('validateLogin - Internal error rules and detail structures', () => {

    it('should return correct body error structure with rule property when body is not an object', () => {
      const details = validateLogin(null);
      
      expect(details).toHaveLength(1);
      expect(details[0]).toEqual({
        field: 'body',
        rule: 'invalid',
        message: 'body must be an object.',
      });
    });

    it('should return rule structure with unknown rule for unexpected properties', () => {
      const body = {
        email: 'test@example.com',
        password: 'password123',
        unauthorizedField: 'value'
      };

      const details = validateLogin(body);
      const unknownError = details.find(d => d.field === 'unauthorizedField');

      expect(unknownError).toBeDefined();
      expect(unknownError.rule).toBe('unknown');
    });

    it('should return required rule when email or password are missing', () => {
      const body = {};
      const details = validateLogin(body);

      const emailError = details.find(d => d.field === 'email');
      const passwordError = details.find(d => d.field === 'password');

      expect(emailError).toBeDefined();
      expect(emailError.rule).toBe('required');

      expect(passwordError).toBeDefined();
      expect(passwordError.rule).toBe('required');
    });

    it('should return invalid rule when email or password have incorrect types or formats', () => {
      const body = {
        email: 12345, // Invalid type for email
        password: ['not-a-string'] // Invalid type for password
      };

      const details = validateLogin(body);

      const emailError = details.find(d => d.field === 'email');
      const passwordError = details.find(d => d.field === 'password');

      expect(emailError).toBeDefined();
      expect(emailError.rule).toBe('invalid');

      expect(passwordError).toBeDefined();
      expect(passwordError.rule).toBe('invalid');
    });

  });

});