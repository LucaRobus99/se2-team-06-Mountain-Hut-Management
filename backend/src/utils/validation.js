import { ValidationError } from '../errors/AppError.js';

/**
 * Small validators shared by the services. Each returns a boolean or the parsed
 * value (null when invalid); the services collect `details` and throw
 * `invalidFields(details)` once, so every error lists all invalid fields.
 */

/** undefined, null or '' – treated as "not sent" for optional fields. */
export function isMissing(value) {
  return value === undefined || value === null || value === '';
}

/** JSON bodies: numbers must be sent as numbers, so only a real positive integer passes. */
export function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

/**
 * Path and query parameters always arrive as text: positive integer from a
 * number or a digits-only string, else null.
 */
export function parsePositiveInt(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return n > 0 ? n : null;
  }
  return null;
}

/** A real calendar date written as YYYY-MM-DD. */
export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** A time written as zero-padded HH:MM (00:00-23:59), so times compare correctly as text. */
export function isValidTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** What a field must be, used in every `invalid` message so they read the same way. */
export const EXPECTED = {
  positiveInt: 'a positive integer',
  date: 'a valid date (YYYY-MM-DD)',
  time: 'a time in HH:MM format',
  text: 'a non-empty string',
  string: 'a string',
  email: 'a valid email address',
  object: 'an object',
  array: 'an array',
};

/** `{field} is required.` */
export function required(field) {
  return { field, rule: 'required', message: `${field} is required.` };
}

/** `{field} must be {expected}.` (expected is usually one of EXPECTED) */
export function invalid(field, expected) {
  return { field, rule: 'invalid', message: `${field} must be ${expected}.` };
}

/** `{field} must be at most {max} characters.` */
export function tooLong(field, max) {
  return { field, rule: 'too_long', message: `${field} must be at most ${max} characters.` };
}

/** `{field} is not allowed.` – a body field the endpoint does not accept. */
export function unknown(field) {
  return { field, rule: 'unknown', message: `${field} is not allowed.` };
}

/** The 400 error every endpoint uses for invalid input. */
export function invalidFields(details) {
  return new ValidationError('The request contains invalid fields.', 'VALIDATION_ERROR', details);
}
