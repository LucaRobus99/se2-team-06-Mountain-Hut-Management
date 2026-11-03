import { describe, it, expect } from 'vitest';
import { createExecutorOf } from '../../../../src/dao/executor.js';

describe('executor - Black-Box Tests', () => {

  it('should route operations to the custom executor and preserve remaining arguments when a valid transaction/db is passed first', () => {
    const defaultDb = { id: 'default' };
    const customDb = { id: 'transactional', query: () => {} };

    const executorOf = createExecutorOf(defaultDb);
    const result = executorOf([customDb, 'user_id_123', { active: true }]);

    expect(result.db).toBe(customDb);
    expect(result.args).toEqual(['user_id_123', { active: true }]);
  });

  it('should use the default database and leave all arguments unchanged when no custom executor is provided', () => {
    const defaultDb = { id: 'default' };

    const executorOf = createExecutorOf(defaultDb);
    const result = executorOf(['user_id_123', { active: true }]);

    expect(result.db).toBe(defaultDb);
    expect(result.args).toEqual(['user_id_123', { active: true }]);
  });

  it('should treat plain values or objects lacking query capabilities as standard arguments rather than executors', () => {
    const defaultDb = { id: 'default' };

    const executorOf = createExecutorOf(defaultDb);
    const result = executorOf(['plain-string', 99, null, { notAQueryMethod: true }]);

    expect(result.db).toBe(defaultDb);
    expect(result.args).toEqual(['plain-string', 99, null, { notAQueryMethod: true }]);
  });

});