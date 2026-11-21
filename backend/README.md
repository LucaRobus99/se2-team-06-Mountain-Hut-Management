# Edelweiss Hut — Backend

**Stack:** Node.js >=22.13, Express 5, PostgreSQL (`pg`; embedded PGlite when `DATABASE_URL` is unset), Passport Local, `express-session` and optional Mailgun (`mailgun.js`). This service manages one mountain hut.

## Setup and startup

From `backend/`:

```bash
npm install
npm start
```

The API listens on `http://localhost:8080` by default. Use `npm run dev` for watch-mode development (restarting the process also resets its in-memory login sessions). Both start scripts read an optional `.env` file; copy `.env.example` when configuring local overrides.

**Database.** With `DATABASE_URL` set (Docker), the service connects to that PostgreSQL server. Without it, it uses an embedded PostgreSQL (PGlite) in `database/pglite` (`PGLITE_DIR`). On first start against an empty database it runs `scripts/01-schema.sql` and `scripts/02-seed.sql`. For the #47 update, compatible databases migrate in place; inconsistent historical table capacities require explicit review. For other schema updates follow the release notes and back up before any reset.

The connection layer is `src/db/postgres.js`: `query(sql, params)` returns `{ rows, rowCount }`, with `$1, $2…` placeholders. `transaction(fn)` takes one global advisory lock, so transactions run one at a time (the first booking saved wins, AC-01.9). `bigint` results (`COUNT`, `SUM`) are parsed as numbers. Quote camelCase column aliases (`AS "tableId"`): PostgreSQL lowercases unquoted names.

**Data safety:** `npm run db:reset` deletes the local embedded database (`database/pglite`). Do not use it on a database containing important data. Keep `.env`, Mailgun credentials and `database/` out of Git.

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
| POST | `/api/bookings` | Hiker | Create the signed-in hiker's own booking (staff get `403` and use `POST /api/staff/bookings`) |
| GET | `/api/bookings` | Hiker | List only the signed-in hiker's bookings (MH-06) |
| GET | `/api/bookings/slot-status?slotId=…` | Hiker | Check whether the hiker already booked the selected slot |
| GET | `/api/bookings/:bookingId` | Owner or staff | Booking details |
| PATCH | `/api/bookings/:bookingId` | Owner (Hiker) | Change slot, party size or requirements (MH-06) |
| GET | `/api/bookings/:bookingId/availability` | Owner (Hiker) | Available modification slots, excluding the current booking's occupied seats (MH-06) |
| DELETE | `/api/bookings/:bookingId` | Owner (Hiker) | Cancel a booking; idempotent and with no time limit (MH-08) |
| GET | `/api/staff/hikers?query=…` | Employee/Warden | Search hikers by name, email or phone (MH-07) |
| GET | `/api/staff/availability` | Employee/Warden | Availability including slots that start within two hours |
| GET | `/api/staff/availability/:slotId/seating` | Employee/Warden | Seating preview for staff bookings |
| POST | `/api/staff/bookings` | Employee/Warden | Book for an existing hiker, a temporary guest or a new hiker account (MH-07) |
| GET | `/api/slots` | Employee/Warden | List slots, optionally filtering by date/meal |
| GET | `/api/slots/:slotId` | Employee/Warden | Slot details |
| GET | `/api/slots/catalog` | Employee/Warden | List physical tables and reusable time patterns |
| POST | `/api/slots/tables` | Employee/Warden | Define a new physical table with fixed seats |
| POST | `/api/slots` | Employee/Warden | Create a slot and choose its tables |

MH-02 (#47): `dining_tables.seats` is fixed for a physical table. Each slot has a subset of tables; the API rejects an existing label with a different seat count (`409 TABLE_CAPACITY_MISMATCH`). A duplicate catalog label returns `409 TABLE_ALREADY_EXISTS`. The composite foreign key also rejects a mismatched slot capacity outside the API. Creating a slot remains atomic.

The application serves one hut. Slot creation uses explicit `startTime` and `endTime` values, not `durationMinutes`; routes containing `/api/huts/:hutId/slots` are not part of the current API. The literal route `/api/bookings/slot-status` is registered before `/api/bookings/:bookingId` so it is not parsed as an ID. MH-07 uses separate staff-only endpoints from the staff Reservations UI.

## Accounts, password changes and avatars

Hikers register with **name, email, phone and password**; notes and emergency contact are optional. The email address and account role are not editable via the profile endpoint. The API identifies the account through the authenticated session rather than accepting a user ID from the request body.

- `PATCH /api/auth/me` validates the supplied fields and saves them to the database.
- `POST /api/auth/change-password` requires `currentPassword` and `newPassword` (8–128 characters), verifies the current password and stores a new password hash.
- `PATCH /api/auth/avatar` accepts one `imageData` field containing a base64-encoded JPEG/PNG/WebP image of at most **400 KB**. The backend checks both the content type and the file signature; the frontend resizes normal uploads before sending.
- Photo bytes are stored in PostgreSQL (`users.avatar_blob` BYTEA, `avatar_mime`, `avatar_version`). `GET /api/auth/avatar` is private and sends `Cache-Control: private, no-store`; `DELETE` removes the image.

All profile, password and photo endpoints enforce authentication; changing a hiker's profile or avatar additionally requires the hiker role.

## Booking and confirmation behavior

The backend enforces table capacity and seating transactionally, even when the UI has already shown an availability preview. A hiker cannot create a second confirmed booking in the same slot. Party requirements (MH-05) include separate dietary/allergy entries and affected guest counts; they are stored with the reservation and returned in booking details.

When Mailgun is configured, creating, updating or cancelling a booking attempts an email. Successful **POST** and **PATCH** responses include `confirmationEmail.status`; **DELETE** returns the same information as `cancellationEmail.status`:

- `sent` — Mailgun accepted the request and returned a message ID; this is not confirmation of inbox delivery;
- `failed` — the submission failed;
- `skipped` — no email configuration/recipient was available (also used when a repeated cancellation does not send a second email).

A successfully persisted booking stays confirmed/updated/cancelled regardless of email status; failed email submissions do not roll back an already committed transaction. `GET /api/bookings` and `GET /api/bookings/:bookingId` do not include this notification result because it is not persisted. Configure `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM` (optional), `MAILGUN_TEMPLATE`, `MAILGUN_UPDATED_TEMPLATE`, `MAILGUN_CANCELLED_TEMPLATE`, `MAILGUN_RESET_TEMPLATE` and optional `MAILGUN_URL` in `.env`. A Mailgun sandbox may require authorizing recipient addresses. Ready-to-upload templates live in `email-templates/` (`booking-confirmation.html`, `booking-modification.html`, `booking-cancelled.html`, `password-reset.html`).

### Uploading templates without dashboard access

Templates must exist **on the configured Mailgun domain**, with an **active version** and a name identical to the env value (spaces included). They can be managed with the API key from `.env`, so dashboard access is not required:

```bash
# read-only: which templates exist and which version is active
npm run mailgun:templates -- --status

# read-only: recent delivery events (failed/rejected/delivered) without dashboard
npm run mailgun:templates -- --events
npm run mailgun:templates -- --events --recipient=name@example.com

# show what would be uploaded, without writing
npm run mailgun:templates -- --dry-run

# create the missing booking templates and publish a version
npm run mailgun:templates -- --only=created,updated,cancelled

# render-check every selected template in Mailgun test mode (no email delivered)
npm run mailgun:templates -- --test --only=created,updated,cancelled
```

The default is non-destructive: a template that already has an active version is skipped. Use `--force` to upload and activate a new version, e.g. for the reset template in `email-templates/password-reset.html`. The script honours `MAILGUN_URL`, so it works with the EU endpoint (`https://api.eu.mailgun.net`).

Mailgun's templates API rejects template names that contain spaces (it returns a generic `500 Internal Server Error`). The booking templates therefore use hyphenated names (`booking-confirmation`, `booking-modification`, `booking-cancelled`) in both `.env` and the defaults. The existing `password reset` template was created from the dashboard and keeps its name; the script never overwrites an active version unless `--force` is used.

### Delivery reliability

Sending a booking email is not a single best-effort call anymore:

- **Recipients** are sent as a bare address (`to: ["name@example.com"]`). A display name supplied by a user (commas, quotes, angle brackets) can no longer invalidate the header and drop the message.
- **Transient failures are retried**: network errors, `429` and `5xx` are attempted up to three times (about 4 seconds in total). Permanent `4xx` errors (invalid recipient, missing template, unauthorised domain) fail immediately, because repeating them cannot succeed.
- **The 16 KB Mailgun limit** on `o:/h:/v:/t:` options is enforced. If an extremely long requirements list would exceed it, only the email copy drops the tail and sets `party_requirements_truncated`; the booking keeps every requirement and the server logs a warning.
- **Startup verification**: when Mailgun is enabled, the backend checks that every configured template exists with an active version and logs the result (it never blocks startup). The same check is available with `npm run mailgun:templates -- --status`.
- **Text alternative**: every stored-template message asks Mailgun to generate the `text/plain` part (`t:text=yes`), which improves accessibility and spam scoring.
- **Diagnostics without the dashboard**: `npm run mailgun:templates -- --events [--recipient=…]` shows recent `failed`, `rejected` and `delivered` events. `sent` in the API means Mailgun accepted the message; Mailgun then retries temporary delivery failures itself.

Remaining hard limits are outside the application: a non-existent or suppressed recipient, a Mailgun outage longer than the retry window, daily plan limits, and spam filtering by the receiving provider. For deliverability, keep SPF and DKIM valid (already verified) and add a DMARC record for the sending domain; a new domain also needs a few days to build reputation.


To diagnose missing emails, look for `[booking-email]` in the backend terminal. An accepted message logs its provider message ID, booking reference and operation. Search that ID in Mailgun Logs to distinguish accepted, delivered and failed events. Logs omit the recipient address and credentials.

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

`GET /api/bookings/:bookingId/availability?date=YYYY-MM-DD&meal=lunch&partySize=2` returns `{ date, meal, partySize, slots }`, with each slot containing `id`, `startTime`, `endTime`, `meal`, `fit` (`single_table` or `split`), `tables` (only `freeSeats` per table, for the Availability cards) and `seatAssignments` (only the guest count per allocated table). It checks ownership, confirmed status, the original and target 48-hour cutoffs, open slots, capacity and duplicate reservations. Only the current booking's seats are excluded from occupied seats. The preview does not change or reserve seats, and does not expose table identifiers. PATCH still checks availability inside its transaction.

`PATCH /api/bookings/:bookingId` changes a booking owned by the authenticated Hiker. The body accepts any subset of these fields:

| Field | Rule |
| --- | --- |
| `slotId` | Positive integer, existing slot with status `available` |
| `partySize` | Positive integer |
| `requirements` | Array of objects `{ "description": string, "allergies": boolean }` |
| `expectedSeating` | Optional preview fit (`single_table` or `split`); prevents an unexpected split during the final allocation |

At least one of slotId, partySize or requirements is required and unknown fields are rejected with `400 VALIDATION_ERROR`. Omitted fields keep their current value; an empty `requirements` array **clears** the saved requirements instead of leaving them unchanged.

The rules below are enforced inside a single serialized transaction:

1. **Ownership** — an unknown ID and another hiker's booking both return `404 BOOKING_NOT_FOUND`, so booking IDs cannot be enumerated.
2. **48-hour rule** — at least 48 hours must remain before the *original* slot begins; when the slot changes, the check is repeated on the *new* slot. Comparison uses `HUT_TIMEZONE`, never the server's local clock.
3. **Seat reallocation** — on each accepted modification (including requirements-only changes), the current seats are released and tables are allocated again under MH-01. If the new party does not fit, the request fails with `409 INSUFFICIENT_CAPACITY` and the whole transaction rolls back.
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
| 409 | `SEATING_CHANGED` | The preview offered a single table but the final allocation would split the group; review the updated preview |

A successful change returns the updated booking in the same shape as a list item, plus `confirmationEmail`. There is no `Location` header because the resource address does not change.

## Cancelling a booking (MH-08)

`DELETE /api/bookings/:bookingId` cancels a booking owned by the authenticated Hiker. There is **no time limit**: cancellation is allowed even after the slot has started.

1. **Ownership** — an unknown ID and another hiker's booking both return `404 BOOKING_NOT_FOUND`, so booking IDs cannot be enumerated. Staff accounts receive `403 FORBIDDEN`.
2. **Seat release** — the booking status becomes `cancelled`. Availability queries count only confirmed bookings, so the seats are immediately available again; `booking_seats` rows are kept for history.
3. **Idempotency** — the transition is one conditional `UPDATE ... WHERE status = 'confirmed'`. Repeated requests return `200` with `alreadyCancelled: true`, do not change availability again and do not resend the email.
4. **Cancellation email** — attempted after the commit; its outcome is `cancellationEmail.status` (`sent`, `failed` or `skipped`). A delivery failure never undoes the cancellation.

```json
{
  "id": 12,
  "status": "cancelled",
  "alreadyCancelled": false,
  "cancellationEmail": { "status": "skipped" },
  "...": "same fields as GET /api/bookings/:bookingId"
}
```

| Status | Code | Meaning |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | Missing or expired session |
| 403 | `FORBIDDEN` | Authenticated, but not a Hiker |
| 404 | `BOOKING_NOT_FOUND` | Unknown booking, or owned by another user |

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

- **existingHiker** — the booking records both `hiker_id` (owner, so it appears in that hiker's `GET /api/bookings`) and `created_by` (staff member). Contact details are copied from the profile. The staff search matches name, email and phone, including phone numbers typed without their stored separators (`3331234567` also finds `+39 333 123 4567`).
- **guest** — no user row is created, so a temporary guest cannot authenticate. `contactName` is required; `contactNumber` and `email` are optional. `POST /api/staff/bookings` is the only way for staff to book; `POST /api/bookings` is hiker-only.
- **newHiker** — a complete hiker account and the booking are created in **one transaction**. The initial password is generated server-side with `node:crypto` (`password_change_required = 1`), only its scrypt hash is stored, and the plaintext value is returned **once** in the `201` response (`initialPassword`, `Cache-Control: no-store`). It is never emailed, logged or exposed by any other endpoint (#46, option A: the attending staff member communicates it). If the booking fails (e.g. `INSUFFICIENT_CAPACITY`), the account is rolled back too.

`#35`: staff may book **until the slot starts**; afterwards the request fails with `422 SLOT_ALREADY_STARTED`. Hikers keep the two-hour cut-off (`422 SLOT_TOO_LATE`). `GET /api/staff/availability` returns the same slots as the public availability plus those starting within two hours.

The optional `expectedSeating` field (`single_table` or `split`) protects the staff preview: if a single-table selection is no longer possible, the transaction returns `409 SEATING_CHANGED` without creating a booking or account. Review the new availability before retrying.

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

- HTTP session cookie `sid` is HttpOnly/SameSite=Lax; Secure cookies apply in production (override with `COOKIE_SECURE=false` when serving over plain HTTP, as the Docker demo does). Express trusts only private-network proxies (`trust proxy`), i.e. the nginx frontend container. Sessions are stored in process memory during development and are lost when the server restarts. Use a durable session store for a deployed multi-instance service.
- Booking and seat allocation run inside serialized PostgreSQL transactions (global advisory lock); availability and seating previews do not reserve seats.
- Slot capacity can vary by meal, date and time because different subsets of tables may be selected; a table's own capacity never changes (#47). Slots may be contiguous but cannot overlap (#31) or cross midnight (#34).
- `HUT_TIMEZONE` defaults to `Europe/Rome` and is used for slot dates, booking cutoffs and the 48-hour modification window.
- Production requires a strong `SESSION_SECRET`; never commit secrets.
- The fixed-capacity update (#47) migrates compatible legacy databases transactionally. If any label has different historical seat counts, or has no historical capacity, startup refuses migration without changing the data. Make a backup and resolve the physical-table inventory deliberately, or use an independent Compose project for clean test data. Other schema changes still follow release-specific migration/reset instructions.

## Testing

From `backend/`:

```bash
npm test            # vitest run
npm run test:watch  # interactive
```

Tests use an in-memory embedded PostgreSQL (PGlite): no Docker or database server needed. `test/globalSetup.js` builds one seeded template; each test file starts from it and every `createTestDb()` resets the data to the seed (`test/helpers/testDb.js`). Suites are organized under `test/unit tests/black box`, `test/unit tests/white box` and `test/integration tests`.

Run the full suite on the current branch. MH-06 integration tests cover booking history, modification availability, ownership, the 48-hour boundary, seat reallocation, rollback and notification failure. Live Mailgun delivery requires separate configuration and validation.
