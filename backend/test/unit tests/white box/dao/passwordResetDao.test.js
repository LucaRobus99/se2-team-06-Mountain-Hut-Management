import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPasswordResetDao } from '../../../../src/dao/passwordResetDao.js';

describe('passwordResetDao - White-Box Unit Tests', () => {
  let mockDb;
  let passwordResetDao;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      query: vi.fn(),
    };
    passwordResetDao = createPasswordResetDao(mockDb);
  });

  describe('deleteExpired', () => {
    it('should execute delete query for expired tokens using provided timestamp', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 2 });
      const nowIso = '2026-11-17T12:00:00.000Z';

      await passwordResetDao.deleteExpired(nowIso);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM password_reset_tokens WHERE expires_at <= $1',
        [nowIso]
      );
    });

    it('should support transaction executor passed as first argument', async () => {
      const mockTx = { query: vi.fn().mockResolvedValueOnce({ rowCount: 1 }) };
      const nowIso = '2026-11-17T12:00:00.000Z';

      await passwordResetDao.deleteExpired(mockTx, nowIso);

      expect(mockTx.query).toHaveBeenCalledTimes(1);
      expect(mockTx.query).toHaveBeenCalledWith(
        'DELETE FROM password_reset_tokens WHERE expires_at <= $1',
        [nowIso]
      );
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('replaceForUser', () => {
    it('should delete existing tokens for user and insert the new token hash', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });
      const userId = 5;
      const tokenHash = 'sha256hashval';
      const expiresAt = '2026-11-18T12:00:00.000Z';

      await passwordResetDao.replaceForUser(userId, tokenHash, expiresAt);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenNthCalledWith(
        1,
        'DELETE FROM password_reset_tokens WHERE user_id = $1',
        [userId]
      );
      expect(mockDb.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO password_reset_tokens'),
        [userId, tokenHash, expiresAt]
      );
    });
  });

  describe('findValidByHash', () => {
    it('should return the valid token row if found', async () => {
      const mockRow = { id: 1, user_id: 5, token_hash: 'hash', expires_at: '2026-11-18', used_at: null };
      mockDb.query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await passwordResetDao.findValidByHash('hash', '2026-11-17T12:00:00.000Z');

      expect(result).toEqual(mockRow);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2'),
        ['hash', '2026-11-17T12:00:00.000Z']
      );
    });

    it('should return null if no valid token matches the criteria', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await passwordResetDao.findValidByHash('nonexistent', '2026-11-17T12:00:00.000Z');

      expect(result).toBeNull();
    });
  });

  describe('markUsed', () => {
    it('should update the token record setting used_at timestamp', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 1 });
      const tokenId = 12;
      const usedAt = '2026-11-17T12:30:00.000Z';

      await passwordResetDao.markUsed(tokenId, usedAt);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE password_reset_tokens SET used_at = $2 WHERE id = $1',
        [tokenId, usedAt]
      );
    });
  });

  describe('deleteForUser', () => {
    it('should delete all password reset tokens for a specific user ID', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 3 });
      const userId = 7;

      await passwordResetDao.deleteForUser(userId);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM password_reset_tokens WHERE user_id = $1',
        [userId]
      );
    });
  });
});