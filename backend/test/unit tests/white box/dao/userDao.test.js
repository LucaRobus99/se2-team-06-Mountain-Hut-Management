import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUserDao } from '../../../../src/dao/userDao.js';

describe('userDao - White-Box Tests (Extended Coverage)', () => {
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

    it('should work with a custom executor (transaction)', async () => {
      const tx = { query: vi.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
      const user = await dao.findByEmail(tx, 'mario@example.com');

      expect(user).toEqual({ id: 1 });
      expect(tx.query).toHaveBeenCalledTimes(1);
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('createHiker', () => {
    it('should insert the user with the hiker role and return the row without passwordChangeRequired if false', async () => {
      const created = { id: 2, role: 'hiker', password_change_required: 0 };
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
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('should update password_change_required to 1 if passwordChangeRequired flag is truthy', async () => {
      const created = { id: 2, role: 'hiker', password_change_required: 0 };
      db.query
        .mockResolvedValueOnce({ rows: [created] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await dao.createHiker({
        name: 'Staff Created',
        email: 'staff@example.com',
        passwordHash: 'hash',
        passwordChangeRequired: 1,
      });

      expect(result.password_change_required).toBe(1);
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(db.query.mock.calls[1][0]).toContain('UPDATE users SET password_change_required = 1');
      expect(db.query.mock.calls[1][1]).toEqual([2]);
    });
  });

  describe('changePassword', () => {
    it('should update password hash and reset password_change_required flag', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await dao.changePassword(10, 'new_hash');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('UPDATE users SET password_hash = $1, password_change_required = 0');
      expect(params).toEqual(['new_hash', 10]);
    });
  });

  describe('updateProfile', () => {
    it('should update profile fields and return the updated user via findById', async () => {
      const updatedUser = { id: 5, name: 'New Name' };
      db.query
        .mockResolvedValueOnce({ rows: [] }) // UPDATE query
        .mockResolvedValueOnce({ rows: [updatedUser] }); // findById query

      const result = await dao.updateProfile(5, {
        name: 'New Name',
        phone: '123',
        notes: 'Notes',
        emergencyContact: 'Contact',
      });

      expect(result).toEqual(updatedUser);
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(db.query.mock.calls[0][0]).toContain('UPDATE users SET name = $1');
      expect(db.query.mock.calls[0][1]).toEqual(['New Name', '123', 'Notes', 'Contact', 5]);
    });
  });

  describe('Avatar methods (setAvatar & getAvatar)', () => {
    it('should update avatar blob, mime and increment version, then return findById', async () => {
      const userWithAvatar = { id: 7, avatar_version: 2 };
      db.query
        .mockResolvedValueOnce({ rows: [] }) // UPDATE avatar
        .mockResolvedValueOnce({ rows: [userWithAvatar] }); // findById

      const result = await dao.setAvatar(7, 'binary-data', 'image/png');

      expect(result).toEqual(userWithAvatar);
      expect(db.query.mock.calls[0][0]).toContain('avatar_version = avatar_version + 1');
      expect(db.query.mock.calls[0][1]).toEqual(['binary-data', 'image/png', 7]);
    });

    it('should retrieve avatar blob and mime correctly', async () => {
      const avatarData = { avatar_blob: 'blob', avatar_mime: 'image/jpeg' };
      db.query.mockResolvedValue({ rows: [avatarData] });

      const result = await dao.getAvatar(7);
      expect(result).toEqual(avatarData);
      expect(db.query.mock.calls[0][1]).toEqual([7]);
    });

    it('should return null if avatar is not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await dao.getAvatar(999);
      expect(result).toBeNull();
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

  describe('searchHikers', () => {
    it('should return an empty array if search term is empty or whitespace', async () => {
      const res1 = await dao.searchHikers('');
      const res2 = await dao.searchHikers('   ');
      const res3 = await dao.searchHikers(null);

      expect(res1).toEqual([]);
      expect(res2).toEqual([]);
      expect(res3).toEqual([]);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should perform a hiker search escaping wildcards and formatting phone digits', async () => {
      const mockHikers = [{ id: 12, name: 'Mario Rossi' }];
      db.query.mockResolvedValue({ rows: mockHikers });

      const result = await dao.searchHikers('mario 333%_\\', 10);

      expect(result).toEqual(mockHikers);
      expect(db.query).toHaveBeenCalledTimes(1);

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain("WHERE role = 'hiker'");
      expect(sql).toContain('LIMIT $3');
      // Params should contain escaped like pattern and extracted digits
      expect(params[0]).toBe('%mario 333\\%\\_\\\\%');
      expect(params[1]).toBe('%333%');
      expect(params[2]).toBe(10);
    });

    it('should omit digitsLike parameter if search term has fewer than 3 digits', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await dao.searchHikers('ab 12');

      const params = db.query.mock.calls[0][1];
      expect(params[1]).toBeNull();
    });
  });
});