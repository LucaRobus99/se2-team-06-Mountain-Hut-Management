// MH-05: each entry describes dietary needs for a subset of the booking party.
// The Product Owner requires an explicit allergy flag on each entry.
export const MAX_REQUIREMENT_DESCRIPTION_LENGTH = 500;

export function validatePartyRequirements(requirements) {
  if (!Array.isArray(requirements)) return 'Please review the dietary requirements.';

  for (const [index, entry] of requirements.entries()) {
    if (!entry || typeof entry.description !== 'string' || !entry.description.trim()) {
      return `Please describe dietary requirement ${index + 1}, or remove the empty entry.`;
    }
    if (entry.description.trim().length > MAX_REQUIREMENT_DESCRIPTION_LENGTH) {
      return `Dietary requirement ${index + 1} must be ${MAX_REQUIREMENT_DESCRIPTION_LENGTH} characters or fewer.`;
    }
    if (typeof entry.allergies !== 'boolean') {
      return `Please review the allergy checkbox for requirement ${index + 1}.`;
    }
  }

  return '';
}

export function serializePartyRequirements(requirements) {
  return requirements.map(({ description, allergies }) => ({
    description: description.trim(),
    allergies,
  }));
}
