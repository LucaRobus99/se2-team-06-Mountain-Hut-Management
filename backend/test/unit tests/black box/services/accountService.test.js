import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAccountService } from '../../../../src/services/accountService.js';
import { ValidationError } from '../../../../src/errors/AppError.js';

// Mock password service to avoid slow hashing during black-box tests
vi.mock('../../../../src/services/password.js', () => ({
  hashPassword: vi.fn((pwd) => `hashed_${pwd}`),
  verifyPassword: vi.fn((hash, pwd) => hash === `hashed_${pwd}`),
}));

describe('accountService - Black-Box Tests', () => {
  let userDao;
  let service;

  const mockUser = {
    id: 1,
    name: 'Mario Rossi',
    phone: '+39333123456',
    notes: 'Some notes',
    emergency_contact: 'Luigi +39333654321',
    password_hash: 'hashed_OldPassword123!',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    userDao = {
      findById: vi.fn().mockResolvedValue(mockUser),
      updateProfile: vi.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
      changePassword: vi.fn().mockResolvedValue(true),
      setAvatar: vi.fn().mockImplementation((id, blob, mime) => Promise.resolve({ id, avatar_mime: mime })),
      getAvatar: vi.fn().mockResolvedValue({ avatar_blob: Buffer.from('test'), avatar_mime: 'image/png' }),
    };

    service = createAccountService({ userDao });
  });

  describe('updateProfile', () => {
    it('should successfully update valid profile fields', async () => {
      const result = await service.updateProfile(1, {
        name: 'New Name',
        phone: '+39333999999',
      });

      expect(userDao.findById).toHaveBeenCalledWith(1);
      expect(userDao.updateProfile).toHaveBeenCalledWith(1, expect.objectContaining({
        name: 'New Name',
        phone: '+39333999999',
      }));
      expect(result.name).toBe('New Name');
    });

    it('should throw ValidationError if profile body is invalid or empty', async () => {
      await expect(service.updateProfile(1, null)).rejects.toThrow(ValidationError);
      await expect(service.updateProfile(1, {})).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if phone number format is invalid', async () => {
      await expect(service.updateProfile(1, { phone: 'abc' })).rejects.toThrow(ValidationError);
    });
  });

  describe('changePassword', () => {
    it('should successfully change password when old password is correct and new is different', async () => {
      await service.changePassword(1, {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewSecurePassword123!',
      });

      expect(userDao.changePassword).toHaveBeenCalledWith(1, 'hashed_NewSecurePassword123!');
    });

    it('should throw ValidationError if current password is incorrect', async () => {
      await expect(
        service.changePassword(1, {
          currentPassword: 'WrongPassword!',
          newPassword: 'NewSecurePassword123!',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if new password is the same as current', async () => {
      await expect(
        service.changePassword(1, {
          currentPassword: 'OldPassword123!',
          newPassword: 'OldPassword123!',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Avatar Management (uploadAvatar, removeAvatar, getAvatar)', () => {
    it('should successfully remove an avatar by setting blob and mime to null', async () => {
      const res = await service.removeAvatar(1);
      expect(userDao.setAvatar).toHaveBeenCalledWith(1, null, null);
      expect(res.avatar_mime).toBeNull();
    });

    it('should successfully retrieve avatar data', async () => {
      const avatar = await service.getAvatar(1);
      expect(userDao.getAvatar).toHaveBeenCalledWith(1);
      expect(avatar).toHaveProperty('avatar_mime', 'image/png');
    });

    it('should reject invalid base64 or unsupported image format during upload', async () => {
      await expect(
        service.uploadAvatar(1, { imageData: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' })
      ).rejects.toThrow(ValidationError);
    });
  });
});