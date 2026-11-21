import {
  EXPECTED,
  invalid,
  invalidFields,
  isMissing,
  isPositiveInt,
  isValidEmail,
  required,
  tooLong,
  unknown,
} from '../utils/validation.js';
import { parseRequirements } from './requirements.js';

/**
 * MH-07: staff can book in three distinguishable ways.
 * - existingHiker: for a hiker who already has an account;
 * - guest:         for a temporary guest without any account;
 * - newHiker:      creating a complete hiker account with a generated password.
 */
export const STAFF_BOOKING_MODES = ['existingHiker', 'guest', 'newHiker'];

const PAYLOAD_FIELDS = {
  existingHiker: ['mode', 'hikerId', 'slotId', 'partySize', 'requirements', 'expectedSeating'],
  guest: ['mode', 'slotId', 'partySize', 'contactName', 'contactNumber', 'email', 'requirements', 'expectedSeating'],
  newHiker: ['mode', 'slotId', 'partySize', 'name', 'email', 'phone', 'notes', 'emergencyContact', 'requirements', 'expectedSeating'],
};

const ANY_MODE_FIELDS = [...new Set(Object.values(PAYLOAD_FIELDS).flat())];

function requiredText(body, field, max, details) {
  const value = body[field];

  if (isMissing(value) || (typeof value === 'string' && !value.trim())) {
    details.push(required(field));
    return null;
  }

  if (typeof value !== 'string') {
    details.push(invalid(field, EXPECTED.text));
    return null;
  }

  const text = value.trim();

  if (text.length > max) {
    details.push(tooLong(field, max));
    return null;
  }

  return text;
}

function optionalText(body, field, max, details) {
  const value = body[field];

  if (isMissing(value)) return null;

  if (typeof value !== 'string') {
    details.push(invalid(field, EXPECTED.text));
    return null;
  }

  const text = value.trim();

  if (!text) return null;

  if (text.length > max) {
    details.push(tooLong(field, max));
    return null;
  }

  return text;
}

/** Same rule as registration/account: international numbers, at least 6 digits. */
function isValidPhone(value) {
  return /^[+\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 6;
}

export function validateStaffBookingBody(body) {
  const details = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidFields([invalid('body', EXPECTED.object)]);
  }

  const mode = body.mode;
  const modeValid = STAFF_BOOKING_MODES.includes(mode);

  if (isMissing(mode)) {
    details.push(required('mode'));
  } else if (!modeValid) {
    details.push(invalid('mode', `one of ${STAFF_BOOKING_MODES.join(', ')}`));
  }

  const allowed = modeValid ? PAYLOAD_FIELDS[mode] : ANY_MODE_FIELDS;

  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) details.push(unknown(key));
  }

  let slotId = null;

  if (isMissing(body.slotId)) {
    details.push(required('slotId'));
  } else if (isPositiveInt(body.slotId)) {
    slotId = body.slotId;
  } else {
    details.push(invalid('slotId', EXPECTED.positiveInt));
  }

  let partySize = null;

  if (isMissing(body.partySize)) {
    details.push(required('partySize'));
  } else if (isPositiveInt(body.partySize)) {
    partySize = body.partySize;
  } else {
    details.push(invalid('partySize', EXPECTED.positiveInt));
  }

  // MH-05: same rules as the hiker booking and the MH-06 change.
  const requirements = parseRequirements(body.requirements, details) ?? [];
  const expectedSeating = body.expectedSeating;
  if ('expectedSeating' in body && !['single_table', 'split'].includes(expectedSeating)) {
    details.push(invalid('expectedSeating', 'single_table or split'));
  }

  let hikerId = null;
  let contact = null;
  let account = null;

  if (mode === 'existingHiker') {
    if (isMissing(body.hikerId)) {
      details.push(required('hikerId'));
    } else if (isPositiveInt(body.hikerId)) {
      hikerId = body.hikerId;
    } else {
      details.push(invalid('hikerId', EXPECTED.positiveInt));
    }
  }

  if (mode === 'guest') {
    const contactName = requiredText(body, 'contactName', 100, details);
    const email = optionalText(body, 'email', 255, details);
    const phone = optionalText(body, 'contactNumber', 30, details);

    if (email && !isValidEmail(email)) details.push(invalid('email', EXPECTED.email));
    if (phone && !isValidPhone(phone)) {
      details.push(invalid('contactNumber', 'a valid phone number (at least 6 digits)'));
    }

    contact = { contactName, email, phone };
  }

  if (mode === 'newHiker') {
    const name = requiredText(body, 'name', 100, details);
    const email = requiredText(body, 'email', 255, details);
    const phone = requiredText(body, 'phone', 30, details);
    const notes = optionalText(body, 'notes', 1000, details);
    const emergencyContact = optionalText(body, 'emergencyContact', 200, details);

    if (email && !isValidEmail(email)) details.push(invalid('email', EXPECTED.email));
    if (phone && !isValidPhone(phone)) {
      details.push(invalid('phone', 'a valid mobile number (at least 6 digits)'));
    }

    account = { name, email: email?.toLowerCase() ?? null, phone, notes, emergencyContact };
  }

  if (details.length > 0) {
    throw invalidFields(details);
  }

  return { mode, slotId, partySize, requirements, hikerId, contact, account, ...(expectedSeating ? { expectedSeating } : {}) };
}

