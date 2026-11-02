import { EXPECTED, invalid, invalidFields, isMissing, isValidEmail, required, tooLong, unknown } from '../utils/validation.js';

// Hiker registration follows context.md and the professor's clarification in issue #22.
// Roles are never accepted from clients: public registration always creates a Hiker.
export function validateRegistration(body) {
  const details = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return [invalid('body', EXPECTED.object)];
  }

  const allowed = new Set(['name', 'email', 'phone', 'password', 'notes', 'emergencyContact']);
  for (const field of Object.keys(body)) {
    if (!allowed.has(field)) details.push(unknown(field));
  }

  for (const [field, max] of [['name', 100], ['email', 255], ['phone', 30]]) {
    const value = body[field];
    if (isMissing(value) || (typeof value === 'string' && !value.trim())) {
      details.push(required(field));
    } else if (typeof value !== 'string') {
      details.push(invalid(field, EXPECTED.text));
    } else if (value.trim().length > max) {
      details.push(tooLong(field, max));
    }
  }
  if (typeof body.email === 'string' && body.email.trim() && !isValidEmail(body.email.trim())) {
    details.push(invalid('email', EXPECTED.email));
  }
  // International mobile numbers can contain +, spaces, dashes and parentheses.
  // Require at least 6 digits, without imposing an Italian-only prefix.
  if (typeof body.phone === 'string' && body.phone.trim() &&
      (!/^[+\d\s().-]+$/.test(body.phone.trim()) || body.phone.replace(/\D/g, '').length < 6)) {
    details.push(invalid('phone', 'a valid mobile number (at least 6 digits)'));
  }

  if (isMissing(body.password)) details.push(required('password'));
  else if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
    details.push(invalid('password', 'between 8 and 128 characters'));
  }

  for (const [field, max] of [['notes', 1000], ['emergencyContact', 200]]) {
    if (isMissing(body[field])) continue;
    if (typeof body[field] !== 'string') details.push(invalid(field, EXPECTED.string));
    else if (body[field].trim().length > max) details.push(tooLong(field, max));
  }
  return details;
}

export function validatedRegistration(body) {
  const errors = validateRegistration(body);
  if (errors.length) throw invalidFields(errors);
  return {
    name: body.name.trim(),
    email: body.email.trim().toLowerCase(),
    phone: body.phone.trim(),
    password: body.password,
    notes: body.notes?.trim() || null,
    emergencyContact: body.emergencyContact?.trim() || null,
  };
}
