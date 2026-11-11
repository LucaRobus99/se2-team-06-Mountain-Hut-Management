import { describe, expect, it } from 'vitest';
import { validatePartyRequirements, serializePartyRequirements, MAX_REQUIREMENT_DESCRIPTION_LENGTH } from '../../../../../src/utils/partyRequirements.js';

describe('MH-05 dietary requirements', () => {
  it('allows a booking without any requirements', () => {
    expect(validatePartyRequirements([])).toBe('');
    expect(serializePartyRequirements([])).toEqual([]);
  });

  it('validates and serializes independent allergy and dietary entries', () => {
    const entries = [
      { id: 1, description: ' 1 vegan guest with peanut allergy ', allergies: true },
      { id: 2, description: ' 2 vegetarian guests ', allergies: false },
    ];
    expect(validatePartyRequirements(entries)).toBe('');
    expect(serializePartyRequirements(entries)).toEqual([
      { description: '1 vegan guest with peanut allergy', allergies: true },
      { description: '2 vegetarian guests', allergies: false },
    ]);
  });

  it('rejects empty entries and invalid allergy flag values', () => {
    expect(validatePartyRequirements([{ description: '  ', allergies: false }])).toMatch(/requirement 1/i);
    expect(validatePartyRequirements([{ description: 'Vegetarian', allergies: 'false' }])).toMatch(/allergy checkbox/i);
    expect(validatePartyRequirements(null)).toMatch(/review/i);
  });

  it('caps each description at the UI field length', () => {
    expect(validatePartyRequirements([{ description: 'a'.repeat(MAX_REQUIREMENT_DESCRIPTION_LENGTH + 1), allergies: true }])).toMatch(/characters or fewer/i);
  });
});
