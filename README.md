# Edelweiss Hut — Mountain Hut Management

Software Engineering II · Team 06 · Politecnico di Torino · AY 2026/27

A web application for managing meals, table availability and reservations at a single mountain hut. It combines a public booking experience, a personal area for registered hikers, and a staff workspace for defining meal slots and their capacity.

## Technology

| Frontend | Backend | Data and services |
| --- | --- | --- |
| React 19, Vite, React Router, Bootstrap/React-Bootstrap | Node.js >=22.13, Express 5, Passport Local and session authentication | SQLite (`node:sqlite`), optional Mailgun booking emails |

## Implemented functionality

- **MH-01 — Book a table:** authenticated hikers select a meal time and party size. The backend assigns tables and seats inside a transaction, preferring one table when possible.
- **MH-02 — Define slot capacity:** staff can create meal slots and configure the tables and seats available for each one.
- **MH-03 — Receive confirmation:** booking confirmation is displayed immediately; a confirmation email is attempted when Mailgun is configured. Email delivery failures do not cancel confirmed bookings.
- **MH-04 — Check availability:** public search by date, meal and number of guests; eligible time slots show their availability.
- **MH-05 — Provide party requirements:** hikers can enter separate dietary/allergy requirements, including the number of affected guests, when confirming a booking. The confirmation page shows the saved information.
- **MH-06 — Change a booking (hiker UI):** hikers can review upcoming, past and cancelled bookings. Opening a reservation shows its details; eligible upcoming reservations can be edited (date, meal/time slot, party size and dietary needs). Available slots are refreshed from the server; changes are rechecked by the backend when saved.
- **My Account (team extension):** hikers can update their name, phone, optional notes and emergency contact, change their password by supplying the current password, and upload/change/remove a profile photo. Changes persist in SQLite. The email address is shown read-only.
- **Authentication:** hiker registration and login/logout; access to staff and hiker endpoints is protected by the backend. A hiker cannot create a second confirmed booking for the same slot.

The staff **Reservations** page remains a placeholder. Hiker booking cancellation (MH-08) and other unfinished stories are not claimed as implemented. MH-06 still requires full end-to-end validation and additional backend PATCH coverage before being considered Done.

## Start locally

Requires Node.js **22.13 or newer** and npm. Use two terminals, starting in the repository root.

**Terminal 1 — backend:**

```bash
cd backend
npm install
npm start
```

**Terminal 2 — frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The backend listens on **http://localhost:8080** by default, and Vite forwards `/api` requests to it. Backend environment variables are optional for local use; see [`backend/.env.example`](backend/.env.example) for the database, session and Mailgun settings. Never commit your `.env` file.

Use `npm run dev` inside `backend/` for auto-restart during backend development. `npm start` is preferable for manual booking/account tests because a watch-mode restart also loses the in-memory session.

On first startup the backend initializes a local SQLite database. Existing databases receive the supported non-destructive schema additions automatically. **Do not use `npm run db:reset` unless you deliberately want to delete your local data.**

## Create demo meal slots (optional)

`backend/scripts/populate-slots.mjs` adds future meal slots without overwriting reservations, existing slots or their capacity. Stop the backend first, then from `backend/`:

```bash
npm run db:seed:slots -- --dry-run
npm run db:seed:slots
```

By default the script covers **tomorrow through 30 September 2027**, with breakfast, lunch, aperitif and dinner intervals. Use `--from=YYYY-MM-DD` and `--to=YYYY-MM-DD` to customize the range. It skips existing/overlapping intervals, including disabled slots. Make a backup of `backend/database/database.sqlite` before running a real import. This script is for local development/demo data, not a required production job.

## Tests and build

```bash
# From backend/
npm test

# From frontend/
npx vitest run
npm run build
```

On 12 November 2026, the backend suite ran successfully with **377 tests across 52 files**, and the frontend production build completed. Rerun these checks after applying new changes; those results do not replace testing the current branch.

## Project structure

- [`frontend/`](frontend/) — React routes, availability, booking, My Bookings, My Account and staff interfaces. See its README for routes and UI behavior.
- [`backend/`](backend/) — REST API, authentication, slot and booking services, SQLite persistence, Mailgun notifications and integration/unit tests. See its README for API routes and data tooling.

## Security and limitations

User identity is taken from the authenticated server-side session, not user IDs supplied by the browser. Booking capacity is checked again inside the write transaction. Uploaded profile photos are stored in the user's SQLite record and served only to that signed-in account. Development sessions are stored in server memory and do not survive a restart.

The SQLite database, credentials, generated files and dependencies should remain local and must not be committed to Git. Deployment with Docker and persistent production sessions requires separate operational configuration.

## License

**Mozilla Public License 2.0** — see [`LICENSE`](LICENSE). MPL 2.0 allows reuse and modification while retaining file-level copyleft for modified MPL-covered files distributed to others.
