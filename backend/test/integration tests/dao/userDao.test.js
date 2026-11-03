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
      // In the seed data (02-seed.sql), user with ID 3 is Hanna Hiker
      const user = await userDao.findById(3);

      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      expect(user.id).toBe(3);
      expect(user.name).toBe('Hanna Hiker');
      expect(user.email).toBe('hiker@hut.test');
      expect(user.role).toBe('hiker');
      expect(user).toHaveProperty('password_hash');
    });

    it('should return null if the user ID does not exist', async () => {
      const user = await userDao.findById(9999);
      expect(user).toBeNull();
    });

  });

  describe('findByEmail', () => {
    
    it('should return the correct user when a valid email exists in the database (case insensitive)', async () => {
      const user = await userDao.findByEmail('Warden@hut.test');

      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      expect(user.id).toBe(1);
      expect(user.name).toBe('Wanda Warden');
      expect(user.role).toBe('warden');
      expect(user).toHaveProperty('password_hash');
    });

    it('should return null if the email does not exist', async () => {
      const user = await userDao.findByEmail('unknown@hut.test');
      expect(user).toBeNull();
    });

  });

  describe('createHiker', () => {

    it('should successfully create a new hiker and return the inserted user record', async () => {
      const newHikerData = {
        name: 'New Hiker',
        email: 'newhiker@hut.test',
        phone: '+393339876543',
        passwordHash: 'hashed_dummy_password',
        notes: 'Vegetarian preference',
        emergencyContact: 'John Doe +393330000000',
      };

      const createdUser = await userDao.createHiker(newHikerData);

      expect(createdUser).toBeDefined();
      expect(createdUser).not.toBeNull();
      expect(createdUser.id).toBeDefined();
      expect(createdUser.role).toBe('hiker');
      expect(createdUser.name).toBe('New Hiker');
      expect(createdUser.email).toBe('newhiker@hut.test');
      expect(createdUser.phone).toBe('+393339876543');
      expect(createdUser.notes).toBe('Vegetarian preference');
      expect(createdUser.emergency_contact).toBe('John Doe +393330000000');

      // Verify persistence via findById
      const fetched = await userDao.findById(createdUser.id);
      expect(fetched).not.toBeNull();
      expect(fetched.email).toBe('newhiker@hut.test');
    });

  });

});