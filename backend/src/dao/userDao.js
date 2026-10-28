export function createUserDao(db) {
  const defaultDb = db;

  function executorOf(args) {
    const [first, ...rest] = args;
    if (first && typeof first.query === 'function') {
      return { db: first, args: rest };
    }
    return { db: defaultDb, args };
  }

  return {
    async findByEmail(...args) {
      const { db: exec, args: a } = executorOf(args);
      const email = a[0];
      const { rows } = await exec.query(
        `SELECT id, role, hut_id, name, email, phone, password_hash, created_at
         FROM users WHERE email = $1`,
        [email]
      );
      return rows[0] ?? null;
    },

    async findById(...args) {
      const { db: exec, args: a } = executorOf(args);
      const id = a[0];
      const { rows } = await exec.query(
        `SELECT id, role, hut_id, name, email, phone, password_hash, created_at
         FROM users WHERE id = $1`,
        [id]
      );
      return rows[0] ?? null;
    },
  };
}