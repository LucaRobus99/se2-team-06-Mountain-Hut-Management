import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAccountService } from '../../../../src/services/accountService.js';
import { ValidationError } from '../../../../src/errors/AppError.js';

describe('accountService - White-Box Tests (Image Validation & Edge Cases)', () => {
  let userDao;
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    userDao = {
      findById: vi.fn().mockResolvedValue({ id: 1, password_hash: 'hash' }),
      setAvatar: vi.fn().mockResolvedValue({ id: 1 }),
    };
    service = createAccountService({ userDao });
  });

  describe('validateAvatar internal logic (Magic bytes & MIME matching)', () => {
    it('should accept a valid PNG base64 image matching header magic bytes', async () => {
      // Valid minimal PNG base64 header
      const validPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

      await expect(service.uploadAvatar(1, { imageData: validPngBase64 })).resolves.toBeDefined();
      expect(userDao.setAvatar).toHaveBeenCalledTimes(1);
    });

    it('should reject when MIME type does not match actual image magic bytes (e.g. JPEG declared for PNG data)', async () => {
      const validPngBase64 = 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

      await expect(service.uploadAvatar(1, { imageData: validPngBase64 })).rejects.toThrow(ValidationError);
    });

    it('should reject payload with unknown keys or invalid object structure', async () => {
      await expect(service.uploadAvatar(1, null)).rejects.toThrow(ValidationError);
      await expect(service.uploadAvatar(1, { imageData: 'abc', extraKey: true })).rejects.toThrow(ValidationError);
    });
  });

  describe('validateProfile internal branches', () => {
    it('should ignore optional fields if not present in body and allow null clearing', async () => {
      userDao.updateProfile = vi.fn().mockResolvedValue({ id: 1 });

      await service.updateProfile(1, { notes: null });
      expect(userDao.updateProfile).toHaveBeenCalledWith(1, expect.objectContaining({ notes: null }));
    });

    it('should throw validation error if unknown property is passed in profile update', async () => {
      await expect(service.updateProfile(1, { unknownField: 'value' })).rejects.toThrow(ValidationError);
    });
  });
});