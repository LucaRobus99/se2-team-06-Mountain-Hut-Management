# Edelweiss Hut — Backend

**Stack:** Node.js >=22.13, Express 5, native `node:sqlite`, Passport Local, `express-session` and optional Mailgun (`mailgun.js`). This service manages one mountain hut.

## Setup and startup

From `backend/`:

```bash
npm install
npm start
```

The API listens on `http://localhost:8080` by default. Use `npm run dev` for watch-mode development (restarting the process also resets its in-memory login sessions). Both start scripts read an optional `.env` file; copy `.env.example` when configuring local overrides.

On first startup the service creates `database/database.sqlite` and initializes the schema and demo records. Later startups apply supported, non-destructive migrations: notes, emergency contact and profile photos on `users`, the MH-05 `booking_requirements` table, the MH-07 `password_change_required` column and `password_reset_tokens` table, and a one-time rebuild of `bookings` so a booking can record both its owner (`hiker_id`) and the staff member who created it (`created_by`). Existing bookings, seats, requirements, slots and users are preserved.

**Data safety:** `npm run db:reset` deletes the local SQLite database. Do not use it on a database containing important data. Keep `.env`, Mailgun credentials and `database/` out of Git.

## API routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/register` | Public | Register and sign in a hiker |
| POST | `/api/auth/login` | Public | Sign in |
| POST | `/api/auth/forgot-password` | Public | Request a password reset link (always 204) |
| POST | `/api/auth/reset-password` | Public | Set a new password with a single-use token (MH-07) |
| GET | `/api/auth/me` | Authenticated | Current user profile |
| PATCH | `/api/auth/me` | Hiker | Update name, phone, notes and emergency contact |
| POST | `/api/auth/change-password` | Authenticated | Change password using the current password |
| GET | `/api/auth/avatar` | Authenticated | Serve only the current user's photo |
| PATCH | `/api/auth/avatar` | Hiker | Upload/replace the current user's photo |
| DELETE | `/api/auth/avatar` | Hiker | Remove the current user's photo |
| POST | `/api/auth/logout` | Authenticated | Log out |
| GET | `/api/availability` | Public | Available meal slots for date, meal and party size |
| GET | `/api/availability/:slotId/seating` | Public | Seating proposal for a slot |
| POST | `/api/bookings` | Authenticated | Create a booking (self-service hiker or staff acting for a guest) |
| GET | `/api/bookings` | Hiker | List only the signed-in hiker's bookings (MH-06) |
| GET | `/api/bookings/slot-status?slotId=…` | Hiker | Check whether the hiker already booked the selected slot |
| GET | `/api/bookings/:bookingId` | Owner or staff | Booking details |
| PATCH | `/api/bookings/:bookingId` | Owner (Hiker) | Change slot, party size or requirements (MH-06) |
| GET | `/api/staff/hikers?query=…` | Employee/Warden | Search hikers by name, email or phone (MH-07) |
| GET | `/api/staff/availability` | Employee/Warden | Availability including slots that start within two hours |
| GET | `/api/staff/availability/:slotId/seating` | Employee/Warden | Seating preview for staff bookings |
| POST | `/api/staff/bookings` | Employee/Warden | Book for an existing hiker, a temporary guest or a new hiker account (MH-07) |
| GET | `/api/slots` | Employee/Warden | List slots, optionally filtering by date/meal |
| GET | `/api/slots/:slotId` | Employee/Warden | Slot details |
| POST | `/api/slots` | Employee/Warden | Create a slot and configure its table capacity |

The application serves one hut. Slot creation uses explicit `startTime` and `endTime` values, not `durationMinutes`; routes containing `/api/huts/:hutId/slots` are not part of the current API. The literal route `/api/bookings/slot-status` is registered before `/api/bookings/:bookingId` so it is not parsed as an ID. Booking cancellation (MH-08) is not implemented yet; MH-07 currently provides the backend API only (the staff page is a frontend task).

## Accounts, password changes and avatars

Hikers register with **name, email, phone and password**; notes and emergency contact are optional. The email address and account role are not editable via the profile endpoint. The API identifies the account through the authenticated session rather than accepting a user ID from the request body.

- `PATCH /api/auth/me` validates the supplied fields and saves them to SQLite.
- `POST /api/auth/change-password` requires `currentPassword` and `newPassword` (8–128 characters), verifies the current password and stores a new password hash.
- `PATCH /api/auth/avatar` accepts one `imageData` field containing a base64-encoded JPEG/PNG/WebP image of at most **400 KB**. The backend checks both the content type and the file signature; the frontend resizes normal uploads before sending.
- Photo bytes are stored in SQLite (`users.avatar_blob`, `avatar_mime`, `avatar_version`). `GET /api/auth/avatar` is private and sends `Cache-Control: private, no-store`; `DELETE` removes the image.

All profile, password and photo endpoints enforce authentication; changing a hiker's profile or avatar additionally requires the hiker role.

## Booking and confirmation behavior

The backend enforces table capacity and seating transactionally, even when the UI has already shown an availability preview. A hiker cannot create a second confirmed booking in the same slot. Party requirements (MH-05) include separate dietary/allergy entries and affected guest counts; they are stored with the reservation and returned in booking details.

When Mailgun is configured, creating or updating a booking attempts a confirmation email. Successful **POST** and **PATCH** responses include `confirmationEmail.status`:

- `sent` — Mailgun accepted the request;
- `failed` — the submission failed;
- `skipped` — no email configuration/recipient was available.

A successfully persisted booking stays confirmed/updated regardless of email status; failed email submissions do not roll back an already committed transaction. `GET /api/bookings` and `GET /api/bookings/:bookingId` do not include this notification result because it is not persisted. Configure `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM` (optional), `MAILGUN_TEMPLATE` and optional `MAILGUN_URL` in `.env`. A Mailgun sandbox may require authorizing recipient addresses. The email template lives in Mailgun, not in this repository.

## Booking history and changes (MH-06)

`GET /api/bookings` returns bookings owned by the authenticated Hiker, ordered by slot date and start time descending. The user is identified through the session cookie, so the route accepts no user parameter and never returns someone else's reservations:

```json
{
  "bookings": [
    {
      "id": 12,
      "status": "confirmed",
      "slot": { "id": 3, "date": "2026-11-15", "startTime": "12:00", "endTime": "13:00", "meal": "lunch" },
      "partySize": 2,
      "requirements": [{ "description": "1 vegetarian guest", "allergies": false }],
      "split": false,
      "seatAssignments": [{ "tableId": 1, "tableLabel": "T1", "seats": 2 }],
      "createdAt": "2026-11-01T09:12:44.123Z"
    }
  ]
}
```

Every item has the same shape as `GET /api/bookings/:bookingId`, including past and cancelled bookings: the client decides how to group them. The route is Hiker-only, so an Employee or Warden receives `403 FORBIDDEN`.

`PATCH /api/bookings/:bookingId` changes a booking owned by the authenticated Hiker. The body accepts any subset of these fields:

| Field | Rule |
| --- | --- |
| `slotId` | Positive integer, existing slot with status `available` |
| `partySize` | Positive integer |
| `requirements` | Array of objects `{ "description": string, "allergies": boolean }` |

At least one field is required and unknown fields are rejected with `400 VALIDATION_ERROR`. Omitted fields keep their current value; an empty `requirements` array **clears** the saved requirements instead of leaving them unchanged.

The rules below are enforced inside a single serialized transaction:

1. **Ownership** — an unknown ID and another hiker's booking both return `404 BOOKING_NOT_FOUND`, so booking IDs cannot be enumerated.
2. **48-hour rule** — at least 48 hours must remain before the *original* slot begins; when the slot changes, the check is repeated on the *new* slot. Comparison uses `HUT_TIMEZONE`, never the server's local clock.
3. **Seat reallocation** — when the slot or party size changes, the current seats are released and tables are allocated again under MH-01. If the new party does not fit, the request fails with `409 INSUFFICIENT_CAPACITY` and the whole transaction rolls back.
4. **One booking per slot** — moving to a slot where the hiker already holds a confirmed booking returns `409 BOOKING_ALREADY_EXISTS`.
5. **Requirements** — stored requirements are replaced, or deleted when the submitted array is empty, inside the transaction.
6. **Confirmation email** — attempted after the commit and never blocks the booking change.

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Malformed payload, unknown field or no field provided |
| 401 | `UNAUTHENTICATED` | Missing or expired session |
| 403 | `FORBIDDEN` | Authenticated, but not a Hiker |
| 404 | `BOOKING_NOT_FOUND` | Unknown booking, or owned by another user |
| 404 | `SLOT_NOT_FOUND` | The target slot does not exist |
| 409 | `TOO_LATE_TO_MODIFY` | Less than 48 hours before the original or the new slot |
| 409 | `SLOT_NOT_AVAILABLE` | The target slot is not open for booking |
| 409 | `BOOKING_ALREADY_EXISTS` | The hiker already has a confirmed booking in the target slot |
| 409 | `INSUFFICIENT_CAPACITY` | The new party size does not fit in the target slot |
| 409 | `BOOKING_NOT_CONFIRMED` | The booking is no longer confirmed |

A successful change returns the updated booking in the same shape as a list item, plus `confirmationEmail`. There is no `Location` header because the resource address does not change.

## Staff reservations and password recovery (MH-07)

`POST /api/staff/bookings` is restricted to **Employee/Warden** and accepts a `mode` that selects one of three flows. Seat allocation, availability checks and party requirements are the same as MH-01/MH-05.

```json
{ "mode": "existingHiker", "hikerId": 3, "slotId": 3, "partySize": 2,
  "requirements": [{ "description": "1 vegan guest", "allergies": false }] }

{ "mode": "guest", "slotId": 3, "partySize": 2,
  "contactName": "Temporary Guest", "contactNumber": "+393331112222" }

{ "mode": "newHiker", "slotId": 3, "partySize": 2,
  "name": "New Hiker", "email": "new.hiker@example.com", "phone": "+393339998877" }
```

- **existingHiker** — the booking records both `hiker_id` (owner, so it appears in that hiker's `GET /api/bookings`) and `created_by` (staff member). Contact details are copied from the profile.
- **guest** — no user row is created, so a temporary guest cannot authenticate. `contactName` is required; `contactNumber` and `email` are optional.
- **newHiker** — a complete hiker account and the booking are created in **one transaction**. The initial password is generated server-side with `node:crypto` (`password_change_required = 1`), only its scrypt hash is stored, and the plaintext value is returned **once** in the `201` response (`initialPassword`, `Cache-Control: no-store`). It is never emailed, logged or exposed by any other endpoint (#46, option A: the attending staff member communicates it). If the booking fails (e.g. `INSUFFICIENT_CAPACITY`), the account is rolled back too.

`#35`: staff may book **until the slot starts**; afterwards the request fails with `422 SLOT_ALREADY_STARTED`. Hikers keep the two-hour cut-off (`422 SLOT_TOO_LATE`). `GET /api/staff/availability` returns the same slots as the public availability plus those starting within two hours.

While `passwordChangeRequired` is true, every authenticated endpoint except `/api/auth/me`, `/api/auth/change-password`, `/api/auth/logout` returns `403 PASSWORD_CHANGE_REQUIRED`; changing the password clears the flag.

### Password recovery (#44)

- `POST /api/auth/forgot-password` always answers `204`, even for unknown addresses (no account enumeration).
- The reset token is random (32 bytes), stored only as a SHA-256 hash, single-use and valid for **24 hours**; a new request invalidates previous links.
- `POST /api/auth/reset-password` accepts `{ "token": "…", "newPassword": "…" }`, clears `passwordChangeRequired` and deletes the outstanding tokens. Invalid, expired or already-used tokens return `400 INVALID_RESET_TOKEN`.
- Configure `APP_BASE_URL` (reset link host) and the Mailgun template `MAILGUN_RESET_TEMPLATE`. Without Mailgun the reset email is skipped, as for booking confirmations.

| Status | Code | Meaning |
| --- | --- | --- |
| 403 | `PASSWORD_CHANGE_REQUIRED` | The account must change its first password |
| 404 | `HIKER_NOT_FOUND` | `hikerId` does not exist or is not a hiker |
| 409 | `EMAIL_ALREADY_REGISTERED` | `newHiker` email already used |
| 422 | `SLOT_ALREADY_STARTED` | Staff booking after the slot began |
| 400 | `INVALID_RESET_TOKEN` | Unknown, expired or reused reset token |

## Populate demo slots safely

From `backend/`, with the server **stopped** and a backup made:

```bash
npm run db:seed:slots -- --dry-run
npm run db:seed:slots
```

The seed script defaults to **tomorrow through 2027-09-30**. Optional flags: `--from=YYYY-MM-DD`, `--to=YYYY-MM-DD` and `--dry-run`. It creates breakfast (09:00 and 10:00), lunch (12:00 and 13:00), aperitif (16:00), and dinner (19:00 and 20:00) hour-long slots. New slots inherit the script's demo T1–T5 seating template; existing or overlapping slots, including disabled ones, are never overwritten.

The actual number of inserted slots depends on the current database. Re-running the script over the same date range skips existing slots and does **not** reset data. The script is a local development utility, not a migration or a production schedule generator.

## Session, time zone and production considerations

- HTTP session cookie `sid` is HttpOnly/SameSite=Lax; Secure cookies apply in production. Sessions are stored in process memory during development and are lost when the server restarts. Use a durable session store for a deployed multi-instance service.
- Booking and seat allocation run inside serialized SQLite transactions; availability and seating previews do not reserve seats.
- Slot capacity can vary by meal, date and time. Slot overlap is currently prohibited, pending the Product Owner's response to issue #31.
- `HUT_TIMEZONE` defaults to `Europe/Rome` and is used for slot dates, booking cutoffs and the 48-hour modification window.
- Production requires a strong `SESSION_SECRET`; never commit secrets.
- Back up the single SQLite database file before schema work or importing demo data.

## Testing

From `backend/`:

```bash
npm test            # vitest run
npm run test:watch  # interactive
```

Tests build in-memory SQLite databases (`:memory:`) using `scripts/01-schema.sql` and `scripts/02-seed.sql`, without touching `backend/database/database.sqlite`. Suites are organized under `test/unit tests/black box`, `test/unit tests/white box` and `test/integration tests`.

On 12 November 2026 the account branch passed **377 tests in 52 files** before merging the newer work from `main`. Run the full suite again after resolving the merge: these earlier results do not validate the combined branch. MH-06 currently has integration coverage for `GET /api/bookings`; `PATCH /api/bookings/:bookingId` and `updateBooking()` still need dedicated unit/route-level coverage before the story is considered Done.
