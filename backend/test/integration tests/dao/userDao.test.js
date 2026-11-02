import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../helpers/dbHelper.js';
import { createUserDao } from '../../../src/dao/userDao.js';

describe('UserDao - Integration Tests', () => {
  let db;
  let userDao;

  beforeEach(() => {
    db = createTestDb();
    userDao = createUserDao(db);
  });

  afterEach(async () => {
    await db.close();
  });

  describe('findById', () => {
    
    it('should return the correct user when a valid ID exists in the database', async () => {
      // Nel seed (02-seed.sql), l'utente con ID 3 è Hanna Hiker
      const user = await userDao.findById(3);

      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      expect(user.id).toBe(3);
      expect(user.name).toBe('Hanna Hiker');
      expect(user.email).toBe('hiker@hut.test');
      expect(user.role).toBe('hiker');
      expect(user.hut_id).toBeNull();
    });

    it('should return null if the user ID does not exist', async () => {
      const user = await userDao.findById(9999);
      expect(user).toBeNull();
    });

  });

  describe('findByEmail', () => {
    
    it('should return the correct user when a valid email exists in the database', async () => {
      const user = await userDao.findByEmail('warden@hut.test');

      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      expect(user.id).toBe(1);
      expect(user.name).toBe('Wanda Warden');
      expect(user.role).toBe('warden');
      expect(user.hut_id).toBe(1);
      expect(user).toHaveProperty('password_hash');
    });

    it('should return null if the email does not exist', async () => {
      const user = await userDao.findByEmail('unknown@hut.test');
      expect(user).toBeNull();
    });

  });

});