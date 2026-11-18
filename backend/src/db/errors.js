/** PostgreSQL SQLSTATE for a unique constraint / unique index violation. */
const UNIQUE_VIOLATION = '23505';

/** Unique indexes on users.email: the column constraint and the case-insensitive index. */
const USER_EMAIL_CONSTRAINTS = new Set(['users_email_key', 'idx_users_email_ci']);

/**
 * True when an INSERT/UPDATE failed because another account already uses the
 * email (e.g. two registrations racing past the lookup).
 */
export function isUniqueEmailViolation(err) {
  return err?.code === UNIQUE_VIOLATION && USER_EMAIL_CONSTRAINTS.has(err.constraint);
}
