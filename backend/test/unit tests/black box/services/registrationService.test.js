import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRegistrationService } from '../../../../src/services/registrationService.js';
import { ConflictError, ValidationError } from '../../../../src/errors/AppError.js';

describe('registrationService - Black-Box Tests', () => {
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

  describe('registerHiker', () => {

    it('should successfully register a new hiker when valid data and unique email are provided', async () => {
      const inputBody = {
        name: 'Mario Rossi',
        email: 'mario.rossi@example.com',
        password: 'StrongPassword123!',
        phone: '+393331234567',
      };

      userDao.findByEmail.mockResolvedValue(null);
      userDao.createHiker.mockResolvedValue({ id: 10, ...inputBody, role: 'hiker' });

      const result = await registrationService.registerHiker(inputBody);

      expect(result).toBeDefined();
      expect(result.id).toBe(10);
      expect(result.email).toBe(inputBody.email);
      expect(userDao.findByEmail).toHaveBeenCalledWith(inputBody.email);
      expect(userDao.createHiker).toHaveBeenCalledOnce();
    });

    it('should throw a ConflictError if the email already exists during the pre-check lookup', async () => {
      const inputBody = {
        name: 'Existing User',
        email: 'existing@hut.test',
        password: 'Password123!',
        phone: '+393331234567',
      };

      userDao.findByEmail.mockResolvedValue({ id: 1, email: 'existing@hut.test' });

      await expect(
        registrationService.registerHiker(inputBody)
      ).rejects.toThrow(ConflictError);

      expect(userDao.createHiker).not.toHaveBeenCalled();
    });

    it('should throw a ConflictError if a race condition triggers a database unique constraint violation', async () => {
      const inputBody = {
        name: 'Concurrent User',
        email: 'concurrent@hut.test',
        password: 'Password123!',
        phone: '+393331234567',
      };

      userDao.findByEmail.mockResolvedValue(null);
      userDao.createHiker.mockRejectedValue(new Error('UNIQUE constraint failed: users.email'));

      try {
        await registrationService.registerHiker(inputBody);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError);
        expect(err.code).toBe('EMAIL_ALREADY_REGISTERED');
      }
    });

    it('should rethrow unexpected database errors that are not unique constraint violations', async () => {
      const inputBody = {
        name: 'Error User',
        email: 'error@hut.test',
        password: 'Password123!',
        phone: '+393331234567',
      };

      userDao.findByEmail.mockResolvedValue(null);
      userDao.createHiker.mockRejectedValue(new Error('Database disk full'));

      await expect(
        registrationService.registerHiker(inputBody)
      ).rejects.toThrow('Database disk full');
    });

    it('should throw a ValidationError if input validation fails', async () => {
      const invalidBody = { email: '' }; // Missing required fields

      await expect(
        registrationService.registerHiker(invalidBody)
      ).rejects.toThrow(ValidationError);

      expect(userDao.findByEmail).not.toHaveBeenCalled();
    });

  });

});