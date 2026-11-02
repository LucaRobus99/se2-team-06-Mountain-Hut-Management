import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../helpers/dbHelper.js';
import { createHutDao } from '../../../src/dao/hutDao.js';

describe('HutDao - Integration Tests', () => {
  let db;
  let hutDao;

  beforeEach(() => {
    // Initialize a clean in-memory SQLite database with schema and seed data
    db = createTestDb();
    hutDao = createHutDao(db);
  });

  afterEach(async () => {
    // Close the database connection after each test
    await db.close();
  });

  describe('findById', () => {
    
    it('should return the correct hut when a valid ID exists in the database', async () => {
      // In the seed data (02-seed.sql), hut with ID 1 is 'Rifugio Demo'
      const hut = await hutDao.findById(1);

      expect(hut).toBeDefined();
      expect(hut).not.toBeNull();
      expect(hut.id).toBe(1);
      expect(hut.name).toBe('Rifugio Demo');
    });

    it('should return null if the hut ID does not exist', async () => {
      const hut = await hutDao.findById(9999);
      expect(hut).toBeNull();
    });

  });

});