import { describe, it, expect } from 'vitest';
import {
  required,
  invalid,
  tooLong,
  unknown,
  invalidFields,
  EXPECTED,
} from '../../../../src/utils/validation.js';
import { ValidationError } from '../../../../src/errors/AppError.js';

describe('Validation Utils - White-Box Tests', () => {

  describe('required error detail generator', () => {
    it('should generate the exact required rule structure and message', () => {
      const detail = required('username');
      expect(detail).toEqual({
        field: 'username',
        rule: 'required',
        message: 'username is required.',
      });
    });
  });

  describe('invalid error detail generator', () => {
    it('should format the message using EXPECTED constants and assign rule as invalid', () => {
      const detail = invalid('age', EXPECTED.positiveInt);
      expect(detail).toEqual({
        field: 'age',
        rule: 'invalid',
        message: 'age must be a positive integer.',
      });
    });
  });

  describe('tooLong error detail generator', () => {
    it('should generate the correct max length constraint rule and message', () => {
      const detail = tooLong('bio', 100);
      expect(detail).toEqual({
        field: 'bio',
        rule: 'too_long',
        message: 'bio must be at most 100 characters.',
      });
    });
  });

  describe('unknown error detail generator', () => {
    it('should generate the unallowed field rule and message', () => {
      const detail = unknown('unrecognizedParam');
      expect(detail).toEqual({
        field: 'unrecognizedParam',
        rule: 'unknown',
        message: 'unrecognizedParam is not allowed.',
      });
    });
  });

  describe('invalidFields wrapper', () => {
    it('should wrap an array of details inside a ValidationError instance with proper metadata', () => {
      const sampleDetails = [
        required('email'),
        invalid('email', EXPECTED.email),
      ];

      const error = invalidFields(sampleDetails);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.status).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('The request contains invalid fields.');
      expect(error.details).toEqual(sampleDetails);
    });
  });

});