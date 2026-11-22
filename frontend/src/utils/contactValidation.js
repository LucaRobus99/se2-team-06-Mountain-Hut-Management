// Contact-field rules shared by login, registration, password recovery,
// My Account and staff reservations (MH-07). Keep them identical to
// backend/src/utils/validation.js so the UI never accepts what the API refuses.

export function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// International mobile numbers: +, digits, spaces, dashes, dots, parentheses,
// with at least 6 digits.
export function isValidPhone(value) {
  return typeof value === 'string' && /^[+\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 6;
}
