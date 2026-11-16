import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../helpers/dbHelper.js';
import { createUserDao } from '../../../src/dao/userDao.js';

describe('UserDao - Integration Tests (Extended Coverage)', () => {
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

    it('should create a hiker with password_change_required flag set to 1 when requested (MH-07)', async () => {
      const staffCreatedData = {
        name: 'Staff Created Hiker',
        email: 'staffhiker@hut.test',
        phone: null, // Necessario per evitare l'undefined su SQLite
        passwordHash: 'temp_hash',
        notes: null,
        emergencyContact: null,
        passwordChangeRequired: 1,
      };

      const createdUser = await userDao.createHiker(staffCreatedData);
      expect(createdUser.password_change_required).toBe(1);

      const fetched = await userDao.findById(createdUser.id);
      expect(fetched.password_change_required).toBe(1);
    });

  });

  describe('changePassword', () => {

    it('should update the password hash and reset password_change_required to 0', async () => {
      // User 3 (Hanna Hiker)
      await userDao.changePassword(3, 'new_secure_hash');

      const updated = await userDao.findById(3);
      expect(updated.password_hash).toBe('new_secure_hash');
      expect(updated.password_change_required).toBe(0);
    });

  });

  describe('updateProfile', () => {

    it('should successfully update user profile details and return the updated record', async () => {
      const updatedUser = await userDao.updateProfile(3, {
        name: 'Hanna Updated',
        phone: '+393331112233',
        notes: 'Gluten-free',
        emergencyContact: 'Emergency Mom +393334445566',
      });

      expect(updatedUser).toBeDefined();
      expect(updatedUser.name).toBe('Hanna Updated');
      expect(updatedUser.phone).toBe('+393331112233');
      expect(updatedUser.notes).toBe('Gluten-free');
      expect(updatedUser.emergency_contact).toBe('Emergency Mom +393334445566');
    });

  });

  describe('Avatar Management (setAvatar & getAvatar)', () => {

    it('should update avatar blob, mime and increment avatar_version', async () => {
      const initialUser = await userDao.findById(3);
      const initialVersion = initialUser.avatar_version || 0;

      const updatedUser = await userDao.setAvatar(3, Buffer.from('fake-image-bytes'), 'image/png');
      expect(updatedUser.avatar_mime).toBe('image/png');
      expect(updatedUser.avatar_version).toBe(initialVersion + 1);

      const avatarRecord = await userDao.getAvatar(3);
      expect(avatarRecord).toBeDefined();
      expect(avatarRecord.avatar_mime).toBe('image/png');
      expect(avatarRecord.avatar_blob).toBeDefined();
    });

    it('should return null if getting avatar for a non-existent user or user without avatar', async () => {
      const avatarRecord = await userDao.getAvatar(9999);
      expect(avatarRecord).toBeNull();
    });

  });

  describe('searchHikers', () => {

    it('should return empty array if search query is empty, whitespace, or invalid', async () => {
      expect(await userDao.searchHikers('')).toEqual([]);
      expect(await userDao.searchHikers('   ')).toEqual([]);
      expect(await userDao.searchHikers(null)).toEqual([]);
    });

    it('should find hikers matching name or email', async () => {
      // User 3 in seed is 'Hanna Hiker' with email 'hiker@hut.test'
      const results = await userDao.searchHikers('Hanna');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe(3);

      const emailResults = await userDao.searchHikers('hiker@hut.test');
      expect(emailResults.length).toBeGreaterThan(0);
      expect(emailResults[0].id).toBe(3);
    });

    it('should find hikers matching phone digits robustly', async () => {
      // Assign a phone number to user 3 for testing digit normalization search
      await userDao.updateProfile(3, {
        name: 'Hanna Hiker',
        phone: '+39 333 123-4567',
        notes: '',
        emergencyContact: '',
      });

      // Search by partial digits matching the phone
      const results = await userDao.searchHikers('333123');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((u) => u.id === 3)).toBe(true);
    });

  });

});