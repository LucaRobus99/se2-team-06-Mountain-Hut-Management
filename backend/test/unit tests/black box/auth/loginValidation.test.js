import { describe, it, expect } from 'vitest';
import { validateLogin } from '../../../../src/auth/loginValidation.js';

describe('loginValidation - Black-Box Tests', () => {

  describe('validateLogin - Body level structure validation', () => {

    it('should return a validation detail if body is missing, null, not an object, or an array', () => {
      expect(validateLogin(null)).toHaveLength(1);
      expect(validateLogin(undefined)).toHaveLength(1);
      expect(validateLogin('not-an-object')).toHaveLength(1);
      expect(validateLogin([1, 2, 3])).toHaveLength(1);

      const details = validateLogin(null);
      expect(details[0].field).toBe('body');
    });

  });

  describe('validateLogin - Allowed and unknown fields', () => {

    it('should return detail if extra unauthorized keys are present in the body', () => {
      const body = {
        email: 'test@example.com',
        password: 'securepassword',
        extraField: 'unexpected',
        anotherField: 123
      };

      const details = validateLogin(body);
      
      // Check that details were returned for the unknown fields
      expect(details.length).toBeGreaterThanOrEqual(2);
      const fields = details.map(d => d.field);
      expect(fields).toContain('extraField');
      expect(fields).toContain('anotherField');
    });

  });

  describe('validateLogin - Email field validation', () => {

    it('should return an error detail if email is missing or undefined', () => {
      const body = { password: 'securepassword' };
      const details = validateLogin(body);

      const emailError = details.find(d => d.field === 'email');
      expect(emailError).toBeDefined();
    });

    it('should return an error detail if email is not a string or is an empty/blank string', () => {
      const invalidValues = ['', '   ', 12345, true];

      for (const val of invalidValues) {
        const body = { email: val, password: 'securepassword' };
        const details = validateLogin(body);

        const emailError = details.find(d => d.field === 'email');
        expect(emailError).toBeDefined();
      }
    });

  });

  describe('validateLogin - Password field validation', () => {

    it('should return an error detail if password is missing or undefined', () => {
      const body = { email: 'test@example.com' };
      const details = validateLogin(body);

      const passwordError = details.find(d => d.field === 'password');
      expect(passwordError).toBeDefined();
    });

    it('should return an error detail if password is not a string (e.g. number or boolean)', () => {
      const invalidValues = [12345, true, {}];

      for (const val of invalidValues) {
        const body = { email: 'test@example.com', password: val };
        const details = validateLogin(body);

        const passwordError = details.find(d => d.field === 'password');
        expect(passwordError).toBeDefined();
      }
    });

  });

  describe('validateLogin - Successful validation', () => {

    it('should return an empty array of details when valid credentials body is provided', () => {
      const validBody = {
        email: 'mario.rossi@example.com',
        password: 'MyPassword123!'
      };

      const details = validateLogin(validBody);
      expect(Array.isArray(details)).toBe(true);
      expect(details).toHaveLength(0);
    });

  });

});