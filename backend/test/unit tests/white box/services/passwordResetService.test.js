import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPasswordResetService } from '../../../../src/services/passwordResetService.js';
import { ValidationError } from '../../../../src/errors/AppError.js';

describe('passwordResetService - White-Box Tests', () => {
  let db;
  let userDao;
  let passwordResetDao;
  let passwordResetService;

  beforeEach(() => {
    vi.clearAllMocks();

    db = { transaction: vi.fn(async (cb) => cb('tx')) };
    userDao = { findByEmail: vi.fn(), changePassword: vi.fn() };
    passwordResetDao = {
      deleteExpired: vi.fn(),
      replaceForUser: vi.fn(),
      findValidByHash: vi.fn(),
      markUsed: vi.fn(),
      deleteForUser: vi.fn(),
    };

    passwordResetService = createPasswordResetService({
      db,
      userDao,
      passwordResetDao,
      appBaseUrl: 'http://localhost:5173/', // Test trailing slash cleanup
    });
  });

  describe('Internal Normalization and Formatting Branches', () => {
    
    it('should normalize email by trimming and lowercasing in request', async () => {
      userDao.findByEmail.mockResolvedValue(null);

      await passwordResetService.request('  MARIO.ROSSI@EXAMPLE.COM  ');

      expect(userDao.findByEmail).toHaveBeenCalledWith('mario.rossi@example.com');
    });

    it('should skip email delivery safely if emailService is not configured', async () => {
      const serviceNoEmail = createPasswordResetService({
        db,
        userDao,
        passwordResetDao,
        emailService: null,
      });

      userDao.findByEmail.mockResolvedValue({ id: 1, email: 'mario@hut.test', name: 'Mario' });

      const result = await serviceNoEmail.request('mario@hut.test');
      expect(result).toEqual({ requested: true, delivery: { status: 'skipped' } });
    });

    it('should clean trailing slashes from appBaseUrl when generating reset link', async () => {
      userDao.findByEmail.mockResolvedValue({ id: 1, email: 'mario@hut.test', name: 'Mario' });
      
      let capturedUrl = '';
      const customEmailService = {
        sendPasswordReset: vi.fn(async ({ resetUrl }) => {
          capturedUrl = resetUrl;
          return { status: 'sent' };
        }),
      };

      const serviceWithCustomBase = createPasswordResetService({
        db,
        userDao,
        passwordResetDao,
        emailService: customEmailService,
        appBaseUrl: 'http://localhost:5173///',
      });

      await serviceWithCustomBase.request('mario@hut.test');
      expect(capturedUrl.startsWith('http://localhost:5173/reset-password?token=')).toBe(true);
    });

  });

});