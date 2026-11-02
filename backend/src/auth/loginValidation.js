import { EXPECTED, invalid, isMissing, required, unknown } from '../utils/validation.js';

/**
 * Validates the login body before Passport checks the credentials, so missing
 * or unknown fields still produce the contract's VALIDATION_ERROR details.
 */
export function validateLogin(body) {
  const details = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    details.push(invalid('body', EXPECTED.object));
    return details;
  }

  const allowed = ['email', 'password'];
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      details.push(unknown(key));
    }
  }

  const email = body.email;
  if (isMissing(email)) {
    details.push(required('email'));
  } else if (typeof email !== 'string' || email.trim() === '') {
    details.push(invalid('email', EXPECTED.text));
  }

  const password = body.password;
  if (isMissing(password)) {
    details.push(required('password'));
  } else if (typeof password !== 'string') {
    details.push(invalid('password', EXPECTED.string));
  }

  return details;
}
