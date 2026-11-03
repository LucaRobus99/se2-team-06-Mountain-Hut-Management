import { describe, it, expect, vi } from 'vitest';
import { createExecutorOf } from '../../../../src/dao/executor.js';

describe('executor - White-Box Tests', () => {

  it('should correctly evaluate the true branch when the first argument has a valid query function', () => {
    const defaultDb = { name: 'default' };
    const transactionalDb = { query: vi.fn(), name: 'transaction' };

    const executorOf = createExecutorOf(defaultDb);
    const result = executorOf([transactionalDb, 'param1', 123]);

    expect(result.db).toBe(transactionalDb);
    expect(result.args).toEqual(['param1', 123]);
  });

  it('should evaluate the false branch when the args array is completely empty', () => {
    const defaultDb = { name: 'default' };

    const executorOf = createExecutorOf(defaultDb);
    const result = executorOf([]);

    expect(result.db).toBe(defaultDb);
    expect(result.args).toEqual([]);
  });

  it('should evaluate the false branch when the first argument is falsy (null or undefined)', () => {
    const defaultDb = { name: 'default' };

    const executorOf = createExecutorOf(defaultDb);
    
    const resNull = executorOf([null, 'arg']);
    expect(resNull.db).toBe(defaultDb);
    expect(resNull.args).toEqual([null, 'arg']);

    const resUndefined = executorOf([undefined, 'arg']);
    expect(resUndefined.db).toBe(defaultDb);
    expect(resUndefined.args).toEqual([undefined, 'arg']);
  });

  it('should evaluate the false branch when query property exists but is not a function', () => {
    const defaultDb = { name: 'default' };
    const invalidExecutorLikeObject = { query: 'not-a-function-string' };

    const executorOf = createExecutorOf(defaultDb);
    const result = executorOf([invalidExecutorLikeObject, 'arg']);

    expect(result.db).toBe(defaultDb);
    expect(result.args).toEqual([invalidExecutorLikeObject, 'arg']);
  });

});