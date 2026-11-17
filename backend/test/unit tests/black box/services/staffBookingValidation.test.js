import { describe, it, expect } from 'vitest';
import { validateStaffBookingBody } from '../../../../src/services/staffBookingValidation.js';
import { ValidationError } from '../../../../src/errors/AppError.js';

describe('staffBookingValidation - Black-Box Tests', () => {

  describe('General Payload & Mode Validation', () => {
    
    it('should throw ValidationError if body is not a valid object or is an array', () => {
      expect(() => validateStaffBookingBody(null)).toThrow(ValidationError);
      expect(() => validateStaffBookingBody([])).toThrow(ValidationError);
      expect(() => validateStaffBookingBody('string')).toThrow(ValidationError);
    });

    it('should throw ValidationError if mode is missing or invalid', () => {
      expect(() => validateStaffBookingBody({ slotId: 1, partySize: 2 })).toThrow(ValidationError);
      expect(() => validateStaffBookingBody({ mode: 'invalidMode', slotId: 1, partySize: 2 })).toThrow(ValidationError);
    });

    it('should detect unknown fields according to the selected mode and throw ValidationError', () => {
      // 'hikerId' is not allowed in 'guest' mode
      expect(() => validateStaffBookingBody({
        mode: 'guest',
        slotId: 1,
        partySize: 2,
        contactName: 'John Doe',
        hikerId: 10
      })).toThrow(ValidationError);
    });

    it('should throw ValidationError if slotId or partySize are missing or not positive integers', () => {
      expect(() => validateStaffBookingBody({ mode: 'existingHiker', hikerId: 1, partySize: 2 })).toThrow(ValidationError);
      expect(() => validateStaffBookingBody({ mode: 'existingHiker', slotId: -1, hikerId: 1, partySize: 2 })).toThrow(ValidationError);
      expect(() => validateStaffBookingBody({ mode: 'existingHiker', slotId: 1, partySize: 0 })).toThrow(ValidationError);
    });

  });

  describe('existingHiker Mode', () => {
    
    it('should successfully validate a correct existingHiker payload', () => {
      const payload = {
        mode: 'existingHiker',
        slotId: 10,
        partySize: 3,
        hikerId: 5,
      };

      const result = validateStaffBookingBody(payload);
      expect(result).toEqual({
        mode: 'existingHiker',
        slotId: 10,
        partySize: 3,
        requirements: [],
        hikerId: 5,
        contact: null,
        account: null,
      });
    });

    it('should throw ValidationError if hikerId is missing or invalid', () => {
      expect(() => validateStaffBookingBody({ mode: 'existingHiker', slotId: 10, partySize: 2 })).toThrow(ValidationError);
      expect(() => validateStaffBookingBody({ mode: 'existingHiker', slotId: 10, partySize: 2, hikerId: 'abc' })).toThrow(ValidationError);
    });

  });

  describe('guest Mode', () => {
    
    it('should successfully validate a correct guest payload with optional email and phone', () => {
      const payload = {
        mode: 'guest',
        slotId: 10,
        partySize: 2,
        contactName: 'Walk-in Visitor',
        email: 'guest@example.com',
        contactNumber: '+39 333 123456',
      };

      const result = validateStaffBookingBody(payload);
      expect(result.mode).toBe('guest');
      expect(result.contact.contactName).toBe('Walk-in Visitor');
      expect(result.contact.email).toBe('guest@example.com');
      expect(result.contact.phone).toBe('+39 333 123456');
    });

    it('should throw ValidationError if contactName is missing, blank, or exceeds max length', () => {
      expect(() => validateStaffBookingBody({ mode: 'guest', slotId: 10, partySize: 2, contactName: '' })).toThrow(ValidationError);
      expect(() => validateStaffBookingBody({ mode: 'guest', slotId: 10, partySize: 2, contactName: '   ' })).toThrow(ValidationError);
      expect(() => validateStaffBookingBody({ mode: 'guest', slotId: 10, partySize: 2, contactName: 'A'.repeat(105) })).toThrow(ValidationError);
    });

    it('should throw ValidationError if guest email or contactNumber format is invalid', () => {
      expect(() => validateStaffBookingBody({
        mode: 'guest', slotId: 10, partySize: 2, contactName: 'Guest', email: 'invalid-email'
      })).toThrow(ValidationError);

      expect(() => validateStaffBookingBody({
        mode: 'guest', slotId: 10, partySize: 2, contactName: 'Guest', contactNumber: '123' // < 6 digits
      })).toThrow(ValidationError);
    });

  });

  describe('newHiker Mode', () => {
    
    it('should successfully validate a correct newHiker payload', () => {
      const payload = {
        mode: 'newHiker',
        slotId: 15,
        partySize: 4,
        name: 'New User',
        email: 'NEW.USER@EXAMPLE.COM',
        phone: '+393339998877',
        notes: 'Vegetarian meals preferred',
        emergencyContact: 'Mom (+393330000000)',
      };

      const result = validateStaffBookingBody(payload);
      expect(result.mode).toBe('newHiker');
      expect(result.account.email).toBe('new.user@example.com'); // Lowercased
      expect(result.account.notes).toBe('Vegetarian meals preferred');
      expect(result.account.emergencyContact).toBe('Mom (+393330000000)');
    });

    it('should throw ValidationError if required newHiker fields (name, email, phone) are missing', () => {
      expect(() => validateStaffBookingBody({
        mode: 'newHiker', slotId: 15, partySize: 4, email: 'a@b.com', phone: '123456'
      })).toThrow(ValidationError); // Missing name

      expect(() => validateStaffBookingBody({
        mode: 'newHiker', slotId: 15, partySize: 4, name: 'User', phone: '123456'
      })).toThrow(ValidationError); // Missing email

      expect(() => validateStaffBookingBody({
        mode: 'newHiker', slotId: 15, partySize: 4, name: 'User', email: 'a@b.com'
      })).toThrow(ValidationError); // Missing phone
    });

    it('should throw ValidationError if newHiker notes or emergencyContact exceed max length', () => {
      expect(() => validateStaffBookingBody({
        mode: 'newHiker',
        slotId: 15,
        partySize: 4,
        name: 'User',
        email: 'a@b.com',
        phone: '12345678',
        notes: 'A'.repeat(1005), // Max 1000
      })).toThrow(ValidationError);
    });

  });

});