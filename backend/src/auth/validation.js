/**
 * Validates the login body before Passport checks the credentials, so missing
 * or unknown fields still produce the contract's VALIDATION_ERROR details.
 */
export function validateLogin(body) {
  const details = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    details.push({ field: 'body', rule: 'invalid', message: 'Request body must be an object.' });
    return details;
  }

  const allowed = ['email', 'password'];
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      details.push({ field: key, rule: 'unknown', message: `${key} is not allowed.` });
    }
  }

  const email = body.email;
  if (email === undefined || email === null) {
    details.push({ field: 'email', rule: 'required', message: 'email is required.' });
  } else if (typeof email !== 'string' || email.trim() === '') {
    details.push({ field: 'email', rule: 'invalid', message: 'email is invalid.' });
  }

  const password = body.password;
  if (password === undefined || password === null) {
    details.push({ field: 'password', rule: 'required', message: 'password is required.' });
  } else if (typeof password !== 'string' || password === '') {
    details.push({ field: 'password', rule: 'invalid', message: 'password is invalid.' });
  }

  return details;
}
