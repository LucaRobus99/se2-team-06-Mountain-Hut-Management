import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPasswordResetService } from '../../../../src/services/passwordResetService.js';
import { ValidationError } from '../../../../src/errors/AppError.js';

describe('passwordResetService - Black-Box Tests', () => {
  let db;
  let userDao;
  let passwordResetDao;
  let emailService;
  let passwordResetService;
  const fixedNow = new Date('2026-08-14T07:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();

    db = {
      transaction: vi.fn(async (callback) => callback('mock-tx')),
    };

    userDao = {
      findByEmail: vi.fn(),
      changePassword: vi.fn(),
    };

    passwordResetDao = {
      deleteExpired: vi.fn(),
      replaceForUser: vi.fn(),
      findValidByHash: vi.fn(),
      markUsed: vi.fn(),
      deleteForUser: vi.fn(),
    };

    emailService = {
      sendPasswordReset: vi.fn().mockResolvedValue({ status: 'sent' }),
    };

    passwordResetService = createPasswordResetService({
      db,
      userDao,
      passwordResetDao,
      emailService,
      appBaseUrl: 'https://hut.test',
      now: () => fixedNow,
    });
  });

  describe('request (Password Recovery Initiation)', () => {
    
    it('should throw ValidationError if email is missing or malformed', async () => {
      await expect(passwordResetService.request('')).rejects.toThrow(ValidationError);
      await expect(passwordResetService.request('invalid-email')).rejects.toThrow(ValidationError);
      await expect(passwordResetService.request(null)).rejects.toThrow(ValidationError);
    });

    it('should silently succeed and skip email/db operations if email does not exist (Anti-Enumeration)', async () => {
      userDao.findByEmail.mockResolvedValue(null); // Account not found

      const result = await passwordResetService.request('unknown@hut.test');

      expect(result).toEqual({ requested: true, delivery: { status: 'skipped' } });
      expect(db.transaction).not.toHaveBeenCalled();
      expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('should successfully create a token, execute transaction, and send email when email exists', async () => {
      userDao.findByEmail.mockResolvedValue({ id: 1, email: 'mario@hut.test', name: 'Mario' });

      const result = await passwordResetService.request('mario@hut.test');

      expect(result).toEqual({ requested: true, delivery: { status: 'sent' } });
      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(passwordResetDao.replaceForUser).toHaveBeenCalled();
      expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'mario@hut.test',
          name: 'Mario',
          resetUrl: expect.stringContaining('https://hut.test/reset-password?token='),
        })
      );
    });

    it('should handle email delivery failure gracefully without revealing account existence', async () => {
      userDao.findByEmail.mockResolvedValue({ id: 1, email: 'mario@hut.test', name: 'Mario' });
      emailService.sendPasswordReset.mockRejectedValueOnce(new Error('SMTP down'));

      const result = await passwordResetService.request('mario@hut.test');

      expect(result).toEqual({ requested: true, delivery: { status: 'failed' } });
    });

  });

  describe('reset (Password Execution)', () => {
    
    it('should throw ValidationError if token or newPassword format is invalid', async () => {
      // Token troppo corto
      await expect(passwordResetService.reset('shorttoken', 'Password123!')).rejects.toThrow(ValidationError);
      // Password troppo corta (< 8 caratteri)
      await expect(passwordResetService.reset('validtokenlongenough123456', 'short')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError (INVALID_RESET_TOKEN) if token is invalid or expired', async () => {
      passwordResetDao.findValidByHash.mockResolvedValue(null);

      await expect(
        passwordResetService.reset('validtokenlongenough123456', 'NewSecurePassword123!')
      ).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
    });

    it('should successfully reset password, mark token as used, and clean up user tokens', async () => {
      passwordResetDao.findValidByHash.mockResolvedValue({ id: 10, user_id: 1 });

      await passwordResetService.reset('validtokenlongenough123456', 'NewSecurePassword123!');

      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(passwordResetDao.markUsed).toHaveBeenCalledWith(expect.anything(), 10, fixedNow.toISOString());
      expect(userDao.changePassword).toHaveBeenCalledWith(expect.anything(), 1, expect.any(String));
      expect(passwordResetDao.deleteForUser).toHaveBeenCalledWith(expect.anything(), 1);
    });

  });

});