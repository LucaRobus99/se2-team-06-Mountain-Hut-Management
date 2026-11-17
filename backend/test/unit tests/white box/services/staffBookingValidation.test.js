import { describe, it, expect } from 'vitest';
import { validateStaffBookingBody, STAFF_BOOKING_MODES } from '../../../../src/services/staffBookingValidation.js';
import { ValidationError } from '../../../../src/errors/AppError.js';

describe('staffBookingValidation - White-Box Tests', () => {

  describe('Mode and Allowed Fields Branches', () => {
    
    it('should validate against ANY_MODE_FIELDS when mode is missing or invalid', () => {
      // Quando la modalità non è valida, il validatore controlla i campi contro ANY_MODE_FIELDS.
      // Un campo totalmente sconosciuto a tutte le modalità deve lanciare un errore.
      expect(() => validateStaffBookingBody({
        mode: 'invalidMode',
        slotId: 1,
        partySize: 2,
        unknownGlobalField: 'not-allowed',
      })).toThrow(ValidationError);
    });

    it('should export the expected STAFF_BOOKING_MODES array', () => {
      expect(STAFF_BOOKING_MODES).toEqual(['existingHiker', 'guest', 'newHiker']);
    });

  });

  describe('Internal Text Validation Branches (requiredText & optionalText)', () => {
    
    it('should validate text type requirements (non-string types or empty strings)', () => {
      // contactName in modalità guest richiede una stringa non vuota
      expect(() => validateStaffBookingBody({
        mode: 'guest',
        slotId: 1,
        partySize: 2,
        contactName: 12345, // Non-string type
      })).toThrow(ValidationError);

      expect(() => validateStaffBookingBody({
        mode: 'guest',
        slotId: 1,
        partySize: 2,
        contactName: '   ', // Solo spazi bianchi (trim -> vuoto)
      })).toThrow(ValidationError);
    });

    it('should handle optionalText branches correctly (omitted, non-string, or empty after trim)', () => {
      // email e contactNumber in modalità guest sono opzionali
      const payload = {
        mode: 'guest',
        slotId: 1,
        partySize: 2,
        contactName: 'Valid Name',
        email: '   ', // Stringa vuota dopo il trim -> ignorata / considerata assente
        contactNumber: null, // Omesso / mancante -> ignorato
      };

      const result = validateStaffBookingBody(payload);
      expect(result.contact.email).toBeNull();
      expect(result.contact.phone).toBeNull();
    });

    it('should reject optionalText if it is not a string', () => {
      expect(() => validateStaffBookingBody({
        mode: 'guest',
        slotId: 1,
        partySize: 2,
        contactName: 'Valid Name',
        email: 99999, // Tipo non valido per un testo opzionale
      })).toThrow(ValidationError);
    });

  });

  describe('Internal Phone Validation Branches (isValidPhone)', () => {
    
    it('should accept valid international phone numbers with spaces, dashes, dots, and plus signs containing at least 6 digits', () => {
      const payload = {
        mode: 'guest',
        slotId: 1,
        partySize: 2,
        contactName: 'Valid Name',
        contactNumber: '+39 (06) 123-4567',
      };

      const result = validateStaffBookingBody(payload);
      expect(result.contact.phone).toBe('+39 (06) 123-4567');
    });

    it('should reject phone numbers with fewer than 6 digits or containing disallowed characters', () => {
      // Meno di 6 cifre
      expect(() => validateStaffBookingBody({
        mode: 'guest',
        slotId: 1,
        partySize: 2,
        contactName: 'Valid Name',
        contactNumber: '12345',
      })).toThrow(ValidationError);

      // Caratteri non consentiti (es. lettere)
      expect(() => validateStaffBookingBody({
        mode: 'guest',
        slotId: 1,
        partySize: 2,
        contactName: 'Valid Name',
        contactNumber: '+39-ABC-123456',
      })).toThrow(ValidationError);
    });

  });

  describe('newHiker Account Email Normalization Branches', () => {
    
    it('should lowercase email and handle null safely in newHiker mode', () => {
      const payload = {
        mode: 'newHiker',
        slotId: 5,
        partySize: 2,
        name: 'Jane Doe',
        email: '   JANE.DOE@EXAMPLE.ORG   ',
        phone: '+393331112233',
      };

      const result = validateStaffBookingBody(payload);
      expect(result.account.email).toBe('jane.doe@example.org');
    });

  });

});