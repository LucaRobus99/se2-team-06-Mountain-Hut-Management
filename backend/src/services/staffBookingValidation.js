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

/**
 * MH-07: staff can book in three distinguishable ways.
 * - existingHiker: for a hiker who already has an account;
 * - guest:         for a temporary guest without any account;
 * - newHiker:      creating a complete hiker account with a generated password.
 */
export const STAFF_BOOKING_MODES = ['existingHiker', 'guest', 'newHiker'];

const PAYLOAD_FIELDS = {
  existingHiker: ['mode', 'hikerId', 'slotId', 'partySize', 'requirements'],
  guest: ['mode', 'slotId', 'partySize', 'contactName', 'contactNumber', 'email', 'requirements'],
  newHiker: ['mode', 'slotId', 'partySize', 'name', 'email', 'phone', 'notes', 'emergencyContact', 'requirements'],
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

/**
 * MH-05 requirements, reused by the staff payload: a free-text description and
 * an independent, explicitly provided allergy flag.
 */
export function normalizeRequirementsInput(value, details) {
  if (isMissing(value)) return [];

  if (!Array.isArray(value)) {
    details.push(invalid('requirements', EXPECTED.array));
    return [];
  }

  const normalized = [];
  let structureError = false;

  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      details.push(invalid('requirements', EXPECTED.object));
      structureError = true;
      continue;
    }

    const description = entry.description;
    let descriptionValid = true;

    if (typeof description !== 'string' || description.trim() === '') {
      details.push(invalid('requirements', EXPECTED.text));
      descriptionValid = false;
    } else if (description.trim().length > 500) {
      details.push(tooLong('requirements', 500));
      descriptionValid = false;
    }

    const allergyValid = typeof entry.allergies === 'boolean';

    if (!allergyValid) {
      details.push(invalid('requirements', 'a boolean'));
    }

    if (descriptionValid && allergyValid) {
      normalized.push({ description: description.trim(), allergies: entry.allergies });
    }
  }

  return structureError ? [] : normalized;
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

  const requirements = normalizeRequirementsInput(body.requirements, details);

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

  return { mode, slotId, partySize, requirements, hikerId, contact, account };
}

