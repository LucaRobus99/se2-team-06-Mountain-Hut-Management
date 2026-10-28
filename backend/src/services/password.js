import crypto from 'node:crypto';

/**
 * Password hashing with scrypt (Node's built-in crypto, no extra dependency).
 *
 * Stored format: `scrypt$<salt hex>$<hash hex>`, with a unique 16-byte salt
 * per password and a 64-byte derived key. Plaintext passwords are never stored
 * or accepted: `verifyPassword` only understands this format.
 */
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };
const HASH_PATTERN = /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/;

export function hashPassword(password) {
  if (typeof password !== 'string' || password === '') {
    throw new TypeError('password must be a non-empty string');
  }
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function isPasswordHash(value) {
  return typeof value === 'string' && HASH_PATTERN.test(value);
}

export function verifyPassword(stored, input) {
  if (!isPasswordHash(stored) || typeof input !== 'string') return false;
  try {
    const [, salt, expected] = stored.split('$');
    const derived = crypto.scryptSync(input, salt, KEY_LENGTH, SCRYPT_OPTIONS).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
