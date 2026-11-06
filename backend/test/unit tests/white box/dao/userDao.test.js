import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUserDao } from '../../../../src/dao/userDao.js';

describe('userDao - White-Box Tests', () => {
  let db;
  let dao;

  beforeEach(() => {
    db = { query: vi.fn() };
    dao = createUserDao(db);
  });

  describe('findByEmail', () => {
    it('should match the email case-insensitively', async () => {
      const user = { id: 1, email: 'mario@example.com' };
      db.query.mockResolvedValue({ rows: [user] });

      await expect(dao.findByEmail('MARIO@example.com')).resolves.toEqual(user);

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('lower(email) = lower($1)');
      expect(params).toEqual(['MARIO@example.com']);
    });

    it('should return null when no user has that email', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(dao.findByEmail('nobody@example.com')).resolves.toBeNull();
    });
  });

  describe('createHiker', () => {
    it('should insert the user with the hiker role and return the row', async () => {
      const created = { id: 2, role: 'hiker' };
      db.query.mockResolvedValue({ rows: [created] });

      const result = await dao.createHiker({
        name: 'Mario Rossi',
        email: 'mario@example.com',
        phone: '+39333',
        passwordHash: 'hash',
        notes: 'vegetarian',
        emergencyContact: 'Luigi',
      });

      expect(result).toEqual(created);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain("'hiker'");
      expect(params).toEqual(['Mario Rossi', 'mario@example.com', '+39333', 'hash', 'vegetarian', 'Luigi']);
    });
  });

  describe('findById', () => {
    it('should return the user when it exists', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 3 }] });

      await expect(dao.findById(3)).resolves.toEqual({ id: 3 });
      expect(db.query.mock.calls[0][1]).toEqual([3]);
    });

    it('should return null when the user does not exist', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(dao.findById(404)).resolves.toBeNull();
    });
  });
});
