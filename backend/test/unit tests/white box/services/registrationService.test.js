import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRegistrationService } from '../../../../src/services/registrationService.js';
import { ConflictError } from '../../../../src/errors/AppError.js';

// Mock the validation helper to return a valid parsed data object directly including a phone
vi.mock('../../../src/auth/registerValidation.js', () => ({
  validatedRegistration: vi.fn((body) => ({ ...body, phone: body.phone || '3331234567' })),
}));

// Mock password hashing to verify internal call and behavior
vi.mock('../../../src/services/password.js', () => ({
  hashPassword: vi.fn((password) => `scrypt$mocked_salt$hashed_${password}`),
}));

describe('registrationService - White-Box Tests', () => {
  let userDao;
  let registrationService;

  beforeEach(() => {
    vi.clearAllMocks();

    userDao = {
      findByEmail: vi.fn(),
      createHiker: vi.fn(),
    };

    registrationService = createRegistrationService({ userDao });
  });

  describe('Internal error handling and error code mapping', () => {

    it('should throw a ConflictError with exact code EMAIL_ALREADY_REGISTERED on pre-check lookup', async () => {
      const body = { email: 'test@hut.test', password: 'password123', name: 'Test', phone: '3331234567' };
      userDao.findByEmail.mockResolvedValue({ id: 1, email: 'test@hut.test' });

      try {
        await registrationService.registerHiker(body);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError);
        expect(err.code).toBe('EMAIL_ALREADY_REGISTERED');
        expect(err.message).toBe('An account with this email already exists.');
      }
    });

    it('should catch database unique constraint failure matching users.email and map to EMAIL_ALREADY_REGISTERED', async () => {
      const body = { email: 'unique@hut.test', password: 'password123', name: 'Test', phone: '3331234567' };
      userDao.findByEmail.mockResolvedValue(null);
      userDao.createHiker.mockRejectedValue(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email'));

      try {
        await registrationService.registerHiker(body);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError);
        expect(err.code).toBe('EMAIL_ALREADY_REGISTERED');
      }
    });

    it('should catch database unique constraint failure matching idx_users_email_ci and map to EMAIL_ALREADY_REGISTERED', async () => {
      const body = { email: 'case@hut.test', password: 'password123', name: 'Test', phone: '3331234567' };
      userDao.findByEmail.mockResolvedValue(null);
      userDao.createHiker.mockRejectedValue(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: idx_users_email_ci'));

      try {
        await registrationService.registerHiker(body);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError);
        expect(err.code).toBe('EMAIL_ALREADY_REGISTERED');
      }
    });

    it('should pass password hash and payload correctly to userDao.createHiker', async () => {
      const body = {
        name: 'John Doe',
        email: 'john@hut.test',
        password: 'SecretPassword!',
        phone: '123456789',
        notes: 'Vegetarian',
        emergencyContact: 'Jane Doe',
      };

      userDao.findByEmail.mockResolvedValue(null);
      userDao.createHiker.mockResolvedValue({ id: 99, ...body });

      await registrationService.registerHiker(body);

      expect(userDao.createHiker).toHaveBeenCalledOnce();
      const passedArg = userDao.createHiker.mock.calls[0][0];
      
      // Verify that passwordHash was generated as a valid scrypt string
      expect(passedArg.passwordHash).toBeTypeOf('string');
      expect(passedArg.passwordHash.startsWith('scrypt$')).toBe(true);
      
      expect(passedArg.name).toBe('John Doe');
      expect(passedArg.email).toBe('john@hut.test');
      expect(passedArg.phone).toBe('123456789');
      expect(passedArg.notes).toBe('Vegetarian');
      expect(passedArg.emergencyContact).toBe('Jane Doe');
    });
  });

});