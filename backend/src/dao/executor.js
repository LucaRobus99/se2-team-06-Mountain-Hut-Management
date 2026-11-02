/**
 * DAO methods accept an optional first argument that is a database/transaction
 * executor (anything with `query`); when it is omitted, the DAO's bound database
 * is used. `createExecutorOf(db)` returns the function that splits the two:
 *
 *   const executorOf = createExecutorOf(db);
 *   const { db: exec, args: a } = executorOf(args);
 */
export function createExecutorOf(defaultDb) {
  return function executorOf(args) {
    const [first, ...rest] = args;
    if (first && typeof first.query === 'function') {
      return { db: first, args: rest };
    }
    return { db: defaultDb, args };
  };
}
