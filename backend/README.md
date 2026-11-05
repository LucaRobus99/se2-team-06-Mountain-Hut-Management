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
| GET | `/api/bookings/:bookingId` | Owner or staff | Read a booking |
| GET | `/api/slots` | Employee/Warden | List slots, optionally filtered by date/meal |
| GET | `/api/slots/:slotId` | Employee/Warden | Slot detail |
| POST | `/api/slots` | Employee/Warden | Create flexible-time slot and table layout |

The application serves one hut. Slot creation uses `startTime` and `endTime`, not a requested `durationMinutes`; routes containing `/api/huts/:hutId/slots` are not part of the current API.

## Email confirmation (MH-03)

Once a booking is saved, the service attempts to send the confirmation through Mailgun using the saved booking details. The **POST** response also contains:

```json
"confirmationEmail": { "status": "sent" }
```

Statuses: `sent` means Mailgun accepted the request, `failed` means submission failed, and `skipped` means email was not configured or no recipient was available. **The booking stays confirmed in all cases.** `GET /api/bookings/:bookingId` does not include this property because the notification result is not persisted.

Configure `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM` (optional) and `MAILGUN_TEMPLATE` in `backend/.env`. In the Mailgun dashboard, create or update an email template whose name matches `MAILGUN_TEMPLATE` (for example, `booking confirmation`). If using a sandbox domain, authorize the recipient address before sending a confirmation. The email template is managed in Mailgun; no local `docs/` directory is required to run the application.

## Session and database notes

- Session cookie `sid` is HttpOnly/SameSite=Lax; production cookies are Secure. Development sessions are stored in process memory (lost on restart); use a persistent session store for a multi-instance deployment.
- Booking and seat allocation are performed inside a serialized SQLite transaction; availability and seating previews do not reserve seats.
- Slotted table capacity can vary across meal/date/time. Slot overlap is currently prohibited, **pending the answer to the Product Owner's issue #31**.
- The backend assumes `HUT_TIMEZONE` (default `Europe/Rome`) for slot dates and booking cutoffs.

## Testing (not changed by this patch)

The repository already includes existing test suites. This patch does not modify or claim to validate them. Later, follow the course's Definition of Done and use the current suites when the team is ready.
