# Edelweiss Hut — Backend

**Stack:** Node.js >=22.13, Express 5, native `node:sqlite`, Passport Local and `express-session`, Mailgun (`mailgun.js`).

## Run locally

From `backend/`:

```bash
npm install
npm run dev
```

The API listens on `http://localhost:8080`. Both `npm run dev` and `npm start` read an optional local `.env` file via `--env-file-if-exists=.env`. **Copy `.env.example` to `.env` and add your Mailgun credentials** if you want confirmation emails. Never commit `.env` or an API key.

The first startup creates an SQLite database from `scripts/01-schema.sql` and `scripts/02-seed.sql`. Existing current-schema Hiker records are migrated when necessary. For legacy schema errors, back up the DB before resetting.

**Destructive command:** `npm run db:reset` permanently removes `backend/database/database.sqlite` while the server is stopped. Do not run it against a database with important bookings.

## API routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/register` | Public | Register a Hiker, automatically sign in |
| POST | `/api/auth/login` | Public | Sign in |
| GET | `/api/auth/me` | Authenticated | Current user |
| POST | `/api/auth/logout` | Authenticated | Sign out |
| GET | `/api/availability` | Public | Slots with seats for date, meal, party size |
| GET | `/api/availability/:slotId/seating` | Public | Table-level proposed seating |
| POST | `/api/bookings` | Authenticated | Create booking (regular UI: Hiker) |
| GET | `/api/bookings` | Hiker | List the hiker's own bookings (MH-06) |
| GET | `/api/bookings/slot-status` | Hiker | Preflight duplicate check for a slot (MH-05) |
| GET | `/api/bookings/:bookingId` | Owner or staff | Read a booking |
| PATCH | `/api/bookings/:bookingId` | Owner (Hiker) | Change slot, party size or requirements (MH-06) |
| GET | `/api/slots` | Employee/Warden | List slots, optionally filtered by date/meal |
| GET | `/api/slots/:slotId` | Employee/Warden | Slot detail |
| POST | `/api/slots` | Employee/Warden | Create flexible-time slot and table layout |

The application serves one hut. Slot creation uses `startTime` and `endTime`, not a requested `durationMinutes`; routes containing `/api/huts/:hutId/slots` are not part of the current API. The literal route `/api/bookings/slot-status` is registered before `/api/bookings/:bookingId`, so it is never parsed as a booking id.

## Email confirmation (MH-03)

Once a booking is saved, the service attempts to send the confirmation through Mailgun using the saved booking details. The **POST** and **PATCH** responses also contain:

```json
"confirmationEmail": { "status": "sent" }
```

Statuses: `sent` means Mailgun accepted the request, `failed` means submission failed, and `skipped` means email was not configured or no recipient was available. **The booking stays confirmed in all cases.** `GET /api/bookings/:bookingId` and `GET /api/bookings` do not include this property because the notification result is not persisted. A failed email never reverts a change: by then the transaction has already been committed.

Configure `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM` (optional) and `MAILGUN_TEMPLATE` in `backend/.env`. In the Mailgun dashboard, create or update an email template whose name matches `MAILGUN_TEMPLATE` (for example, `booking confirmation`). If using a sandbox domain, authorize the recipient address before sending a confirmation. The email template is managed in Mailgun; no local `docs/` directory is required to run the application.

## Booking history and changes (MH-06)

`GET /api/bookings` returns the bookings owned by the authenticated Hiker, ordered by slot date and start time descending. The hiker is taken from the session cookie, so the route accepts no user parameter and can never return another user's booking:

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

The rules below are all enforced inside a single serialized transaction:

1. **Ownership** — an unknown id and another hiker's booking both return `404 BOOKING_NOT_FOUND`, so booking ids cannot be enumerated.
2. **48-hour rule** — at least 48 hours must remain before the start of the *original* slot; when the slot changes, the same check is repeated on the *new* slot. The comparison uses `HUT_TIMEZONE`, never the server's local clock.
3. **Seat reallocation** — when the slot or the party size changes, the seats currently held are released first and the tables are assigned again with the MH-01 rules, so a booking never counts against itself while it stays in the same slot. If the new party does not fit, the request fails with `409 INSUFFICIENT_CAPACITY` and the booking is left **exactly as it was**: release, reassignment and update are rolled back together.
4. **One booking per slot** — moving to a slot where the hiker already holds a confirmed booking returns `409 BOOKING_ALREADY_EXISTS`.
5. **Requirements** — the stored rows are replaced, or deleted when the array is empty, in the same transaction as the seat change.
6. **Confirmation email** — sent after the commit and never blocking the change.

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
| 409 | `BOOKING_NOT_CONFIRMED` | The booking is no longer `confirmed` (for example after a cancellation) |

A successful change returns the updated booking in the same shape as a list item, plus `confirmationEmail`. There is no `Location` header because the resource address does not change.

## Session and database notes

- Session cookie `sid` is HttpOnly/SameSite=Lax; production cookies are Secure. Development sessions are stored in process memory (lost on restart); use a persistent session store for a multi-instance deployment.
- Booking and seat allocation are performed inside a serialized SQLite transaction; availability and seating previews do not reserve seats.
- Slotted table capacity can vary across meal/date/time. Slot overlap is currently prohibited, **pending the answer to the Product Owner's issue #31**.
- The backend assumes `HUT_TIMEZONE` (default `Europe/Rome`) for slot dates, booking cutoffs and the 48-hour modification window.

## Testing

From `backend/`:

```bash
npm test            # vitest run
npm run test:watch  # interactive
```

Tests build an in-memory SQLite database (`:memory:`) with the same `scripts/01-schema.sql` and `scripts/02-seed.sql` used by the application, so they never touch `backend/database/database.sqlite`. The suites are organised as `test/unit tests/black box`, `test/unit tests/white box` and `test/integration tests`.

MH-06 is currently exercised only by the integration tests for `GET /api/bookings`. `PATCH /api/bookings/:bookingId` and `updateBooking()` still need unit and route-level coverage before the story can be considered Done.
