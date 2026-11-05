import { describe, it, expect } from 'vitest';
import { ROLES, STAFF_ROLES, STAFF_ONLY_MESSAGE, isStaff } from '../../../../src/auth/roles.js';

describe('roles - Black-Box Tests', () => {

  it('should expose the correct available user roles and staff roles', () => {
    expect(ROLES).toContain('hiker');
    expect(ROLES).toContain('employee');
    expect(ROLES).toContain('warden');

    expect(STAFF_ROLES).toContain('employee');
    expect(STAFF_ROLES).toContain('warden');
    expect(STAFF_ROLES).not.toContain('hiker');
  });

  it('should return true for staff roles (employee and warden) when calling isStaff', () => {
    expect(isStaff({ role: 'employee' })).toBe(true);
    expect(isStaff({ role: 'warden' })).toBe(true);
  });

  it('should return false for non-staff roles or missing/null users when calling isStaff', () => {
    expect(isStaff({ role: 'hiker' })).toBe(false);
    expect(isStaff({ role: 'unknown' })).toBe(false);
    expect(isStaff(null)).toBe(false);
    expect(isStaff(undefined)).toBe(false);
    expect(isStaff({})).toBe(false);
  });

  it('should provide the standard staff-only error message string', () => {
    expect(STAFF_ONLY_MESSAGE).toBeTypeOf('string');
    expect(STAFF_ONLY_MESSAGE.length).toBeGreaterThan(0);
  });

});