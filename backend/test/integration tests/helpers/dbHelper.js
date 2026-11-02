import { createSqliteDb } from '../../../src/db/sqlite.js';
export function createTestDb() {
  return createSqliteDb(':memory:');
}