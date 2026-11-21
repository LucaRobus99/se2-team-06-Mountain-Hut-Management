import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../helpers/dbHelper.js';
import { createPasswordResetDao } from '../../../src/dao/passwordResetDao.js';

describe('PasswordResetDao - Integration Tests', () => {
  let db;
  let passwordResetDao;
  const testUserId = 3; // Using Hanna Hiker from seed data (02-seed.sql)

  beforeEach(() => {
    db = createTestDb();
    passwordResetDao = createPasswordResetDao(db);
  });

  afterEach(async () => {
    if (db && typeof db.close === 'function') {
      await db.close();
    }
  });

  describe('replaceForUser and findValidByHash', () => {
    it('should successfully store a new token, invalidate previous ones, and retrieve it by hash if valid', async () => {
      const tokenHashFirst = 'hash_one_abc123';
      const tokenHashSecond = 'hash_two_xyz789';
      const expiresAt = '2026-11-18T12:00:00.000Z';
      const nowIso = '2026-11-17T12:00:00.000Z';

      // Store first token
      await passwordResetDao.replaceForUser(testUserId, tokenHashFirst, expiresAt);
      
      let foundFirst = await passwordResetDao.findValidByHash(tokenHashFirst, nowIso);
      expect(foundFirst).not.toBeNull();
      expect(foundFirst.token_hash).toBe(tokenHashFirst);
      expect(foundFirst.user_id).toBe(testUserId);

      // Replace with second token (should delete the first one)
      await passwordResetDao.replaceForUser(testUserId, tokenHashSecond, expiresAt);

      foundFirst = await passwordResetDao.findValidByHash(tokenHashFirst, nowIso);
      const foundSecond = await passwordResetDao.findValidByHash(tokenHashSecond, nowIso);

      expect(foundFirst).toBeNull();
      expect(foundSecond).not.toBeNull();
      expect(foundSecond.token_hash).toBe(tokenHashSecond);
    });
  });

  describe('markUsed and expiration filters', () => {
    it('should correctly filter out expired or already used tokens in findValidByHash', async () => {
      const tokenHash = 'valid_checking_hash';
      const futureExpires = '2026-11-19T12:00:00.000Z';
      const pastExpires = '2026-11-16T12:00:00.000Z';
      const nowIso = '2026-11-17T12:00:00.000Z';
      const usedAtTime = '2026-11-17T13:00:00.000Z';

      // 1. Insert a valid token
      await passwordResetDao.replaceForUser(testUserId, tokenHash, futureExpires);
      let validRecord = await passwordResetDao.findValidByHash(tokenHash, nowIso);
      expect(validRecord).not.toBeNull();

      // 2. Mark token as used
      await passwordResetDao.markUsed(validRecord.id, usedAtTime);

      // Should now return null because used_at is not NULL
      const usedRecordResult = await passwordResetDao.findValidByHash(tokenHash, nowIso);
      expect(usedRecordResult).toBeNull();

      // 3. Test expiration filter: create a token that expires in the past
      const expiredTokenHash = 'expired_hash_999';
      await passwordResetDao.replaceForUser(testUserId, expiredTokenHash, pastExpires);
      const expiredRecordResult = await passwordResetDao.findValidByHash(expiredTokenHash, nowIso);
      expect(expiredRecordResult).toBeNull();
    });
  });

  describe('deleteExpired', () => {
    it('should successfully delete expired tokens using deleteExpired housekeeping method', async () => {
      const expiredHash = 'expired_token_hash';
      const nowIso = '2026-11-17T12:00:00.000Z';

      // Insert an expired token
      await passwordResetDao.replaceForUser(testUserId, expiredHash, '2026-11-16T00:00:00.000Z');
      
      let tokenRecord = await passwordResetDao.findValidByHash(expiredHash, '2026-11-15T00:00:00.000Z');
      expect(tokenRecord).not.toBeNull();

      await passwordResetDao.deleteExpired(nowIso);

      const expiredResult = await passwordResetDao.findValidByHash(expiredHash, '2026-11-15T00:00:00.000Z');
      expect(expiredResult).toBeNull();
    });
  });

  describe('deleteForUser', () => {
    it('should delete all tokens associated with a specific user via deleteForUser', async () => {
      const tokenHash = 'user_deletion_hash';
      const futureExpires = '2026-11-19T12:00:00.000Z';
      const nowIso = '2026-11-17T12:00:00.000Z';

      await passwordResetDao.replaceForUser(testUserId, tokenHash, futureExpires);
      
      let tokenRecord = await passwordResetDao.findValidByHash(tokenHash, nowIso);
      expect(tokenRecord).not.toBeNull();

      await passwordResetDao.deleteForUser(testUserId);

      tokenRecord = await passwordResetDao.findValidByHash(tokenHash, nowIso);
      expect(tokenRecord).toBeNull();
    });
  });
});