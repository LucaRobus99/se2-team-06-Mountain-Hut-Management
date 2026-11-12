# Edelweiss Hut — Backend

**Stack:** Node.js >=22.13, Express 5, native `node:sqlite`, Passport Local, `express-session` and optional Mailgun (`mailgun.js`). This service manages one mountain hut.

## Setup and startup

From `backend/`:

```bash
npm install
npm start
```

The API listens on `http://localhost:8080` by default. Use `npm run dev` for watch-mode development (restarting the process also resets its in-memory login sessions). Both start scripts read an optional `.env` file; copy `.env.example` when configuring local overrides.

On first startup the service creates `database/database.sqlite` and initializes the schema and demo records. Later startups apply supported, non-destructive user-table schema updates for notes, emergency contact and profile photos. Existing bookings, slots and user data are preserved by these migrations.

**Data safety:** `npm run db:reset` deletes the local SQLite database. Do not use it on a database containing important data. Keep `.env`, Mailgun credentials and `database/` out of Git.

## API routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/register` | Public | Register and sign in a hiker |
| POST | `/api/auth/login` | Public | Sign in |
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
| GET | `/api/bookings` | Hiker | List only the signed-in hiker's bookings |
| GET | `/api/bookings/slot-status?slotId=…` | Hiker | Check if the hiker already booked the selected slot |
| GET | `/api/bookings/:bookingId` | Owner or staff | Booking details |
| GET | `/api/slots` | Employee/Warden | List slots, optionally filtering by date/meal |
| GET | `/api/slots/:slotId` | Employee/Warden | Slot details |
| POST | `/api/slots` | Employee/Warden | Create a slot and configure its table capacity |

The current implementation does not expose a booking update/cancellation API or a completed staff Reservations management page. Slot creation uses explicit `startTime` and `endTime` values.

## Accounts, password changes and avatars

Hikers register with **name, email, phone and password**; notes and emergency contact are optional. The email address and account role are not editable via the profile endpoint. The API checks ownership through the session rather than accepting a user ID from the request body.

- `PATCH /api/auth/me` validates the supplied fields and saves them to SQLite.
- `POST /api/auth/change-password` requires `currentPassword` and `newPassword` (8–128 characters), verifies the current password and stores a new password hash.
- `PATCH /api/auth/avatar` accepts one `imageData` field containing a base64-encoded JPEG/PNG/WebP image of at most **400 KB**. The backend checks both the content type and the file signature; the frontend resizes normal uploads before sending.
- Photo bytes are stored in SQLite (`users.avatar_blob`, `avatar_mime`, `avatar_version`). `GET /api/auth/avatar` is private and sends `Cache-Control: private, no-store`; `DELETE` removes the image.

All profile, password and photo endpoints enforce authentication; changing a hiker's profile or avatar additionally requires the hiker role.

## Booking and confirmation behavior

The backend enforces table capacity and seating transactionally, even when a UI has already shown an availability preview. A hiker cannot create a second confirmed booking in the same slot. Party requirements (MH-05) include separate dietary/allergy entries and affected guest counts; they are stored with the reservation and returned in booking details.

If Mailgun is configured, creating a booking attempts a confirmation email. The **POST** response contains `confirmationEmail.status`:

- `sent` — Mailgun accepted the request;
- `failed` — the submission failed;
- `skipped` — no email configuration/recipient was available.

A successfully persisted booking stays confirmed regardless of email status. Configure `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM` (optional), `MAILGUN_TEMPLATE` and optional `MAILGUN_URL` in `.env`. A Mailgun sandbox may require authorizing recipient addresses. The email template lives in Mailgun, not in this repository.

## Populate demo slots safely

From `backend/`, with the server **stopped** and a backup made:

```bash
npm run db:seed:slots -- --dry-run
npm run db:seed:slots
```

The seed script defaults to **tomorrow through 2027-09-30**. Optional flags: `--from=YYYY-MM-DD`, `--to=YYYY-MM-DD` and `--dry-run`. It creates breakfast (09:00 and 10:00), lunch (12:00 and 13:00), aperitif (16:00) and dinner (19:00 and 20:00) hour-long slots. New slots inherit the script's demo T1–T5 seating template; existing or overlapping slots, including disabled ones, are never overwritten.

The actual number of inserted slots depends on the current database. Re-running the script over the same date range will skip slots already inserted. It does **not** reset data. The script is a local development utility, not a migration or a required production schedule generator.

## Testing

```bash
npm test
# Optional continuous test runner:
npm run test:watch
```

As observed on 12 November 2026, the test run completed **377 tests in 52 files**, including authenticated account API tests. Rerun before merging further changes.

## Session, time zone and production considerations

- HTTP session cookie `sid` is HttpOnly/SameSite=Lax; Secure cookies apply in production. Sessions live in process memory during development, so they are lost when the server restarts. Use a durable session store for a deployed multi-instance service.
- `HUT_TIMEZONE` defaults to `Europe/Rome` and is used for meal slot dates and booking cutoffs.
- Production requires a strong `SESSION_SECRET`; never commit secrets.
- The application uses a single SQLite database file. Preserve database backups when testing schema changes or importing demo data.
