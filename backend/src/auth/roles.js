/** User roles (users.role). */
export const ROLES = ['hiker', 'employee', 'warden'];

/** Roles that manage the hut: slots (MH-02) and bookings on behalf of guests. */
export const STAFF_ROLES = ['employee', 'warden'];

/** 403 message for staff-only endpoints (route middleware and service use the same text). */
export const STAFF_ONLY_MESSAGE = 'Only employees and wardens can manage slots.';

export function isStaff(user) {
  return STAFF_ROLES.includes(user?.role);
}
