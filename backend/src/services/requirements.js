import { EXPECTED, invalid, isMissing, tooLong } from '../utils/validation.js';

/** MH-05: longest accepted description of one party requirement. */
export const MAX_REQUIREMENT_LENGTH = 500;

/**
 * MH-05: validates the `requirements` field of any booking payload (hiker
 * booking, MH-06 change, MH-07 staff booking), so all of them accept exactly
 * the same input.
 *
 * Each entry is `{ description: non-empty text, allergies: boolean }`. The
 * allergy flag must be sent explicitly (PO: it makes the issue visible).
 *
 * Errors are pushed into `details`; the caller throws them together with its
 * other validation errors, so an invalid entry rejects the whole request and
 * requirements are never saved partially.
 *
 * @returns {null | Array<{description: string, allergies: boolean}>}
 *          `null` when the field is absent, otherwise the trimmed list
 *          (an empty array is a valid "no requirements").
 */
export function parseRequirements(value, details) {
  if (isMissing(value)) return null;

  if (!Array.isArray(value)) {
    details.push(invalid('requirements', EXPECTED.array));
    return null;
  }

  const requirements = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      details.push(invalid('requirements', EXPECTED.object));
      continue;
    }

    const description = typeof entry.description === 'string' ? entry.description.trim() : '';
    let valid = true;

    if (description === '') {
      details.push(invalid('requirements', EXPECTED.text));
      valid = false;
    } else if (description.length > MAX_REQUIREMENT_LENGTH) {
      details.push(tooLong('requirements', MAX_REQUIREMENT_LENGTH));
      valid = false;
    }

    if (typeof entry.allergies !== 'boolean') {
      details.push(invalid('requirements', 'a boolean'));
      valid = false;
    }

    if (valid) requirements.push({ description, allergies: entry.allergies });
  }

  return requirements;
}
