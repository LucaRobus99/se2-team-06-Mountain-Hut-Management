/** User roles (users.role). */
export const ROLES = ['hiker', 'employee', 'warden'];

/** Roles that manage the hut: slots (MH-02) and bookings on behalf of guests. */
export const STAFF_ROLES = ['employee', 'warden'];

/** 403 message for staff-only endpoints (route middleware and service use the same text). */
export const STAFF_ONLY_MESSAGE = 'Only employees and wardens can manage slots.';

/**
 * 403 message for the hiker booking endpoint (POST /api/bookings). Staff book
 * on someone's behalf through POST /api/staff/bookings (MH-07).
 */
export const HIKER_BOOKING_MESSAGE =
  'Only hiker accounts can book online. Staff bookings are made from the staff reservations area.';

/** 403 message for the hiker cancellation endpoint (DELETE /api/bookings/:id, MH-08). */
export const HIKER_CANCEL_MESSAGE = 'Only hiker accounts can cancel their bookings.';

export function isStaff(user) {
  return STAFF_ROLES.includes(user?.role);
}
