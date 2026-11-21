import { describe, it, expect } from 'vitest';
import { ROLES, STAFF_ROLES, isStaff } from '../../../../src/auth/roles.js';

describe('roles - White-Box Tests', () => {

  it('should ensure all STAFF_ROLES are strictly a subset of global ROLES', () => {
    for (const staffRole of STAFF_ROLES) {
      expect(ROLES).toContain(staffRole);
    }
  });

  it('should safely handle undefined or malformed user objects via optional chaining without throwing', () => {
    expect(() => isStaff(null)).not.toThrow();
    expect(() => isStaff(undefined)).not.toThrow();
    expect(() => isStaff({})).not.toThrow();
  });
it('should evaluate isStaff correctly based on internal STAFF_ROLES array inclusion', () => {
    // Ramo true: ogni ruolo presente in STAFF_ROLES deve restituire true
    STAFF_ROLES.forEach((role) => {
      expect(isStaff({ role })).toBe(true);
    });

    // Ramo false: ruoli non staff o proprietà role non valide
    expect(isStaff({ role: 'hiker' })).toBe(false);
    expect(isStaff({ role: null })).toBe(false);
    expect(isStaff({ role: 123 })).toBe(false);
  });
  
});