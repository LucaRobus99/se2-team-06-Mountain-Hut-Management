/** DAO for huts. */
export function createHutDao(db) {
  const defaultDb = db;

  function executorOf(args) {
    const [first, ...rest] = args;
    if (first && typeof first.query === 'function') {
      return { db: first, args: rest };
    }
    return { db: defaultDb, args };
  }

  return {
    async findById(...args) {
      const { db: exec, args: a } = executorOf(args);
      const id = a[0];
      const { rows } = await exec.query('SELECT id, name FROM huts WHERE id = $1', [id]);
      return rows[0] ?? null;
    },
  };
}
