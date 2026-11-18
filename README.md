# Edelweiss Hut — Mountain Hut Management

Software Engineering II · Team 06 · Politecnico di Torino · AY 2026/27

A web application for managing meals, table availability and reservations at a single mountain hut. It combines a public booking experience, a personal area for registered hikers, and a staff workspace for defining meal slots and their capacity.

## Technology

| Frontend | Backend | Data and services |
| --- | --- | --- |
| React 19, Vite, React Router, Bootstrap/React-Bootstrap | Node.js >=22.13, Express 5, Passport Local and session authentication | PostgreSQL 17 (embedded PGlite for local dev/tests), optional Mailgun booking emails |

## Implemented functionality

- **MH-01 — Book a table:** authenticated hikers select a meal time and party size. The backend assigns tables and seats inside a transaction, preferring one table when possible.
- **MH-02 — Define slot capacity:** staff can create meal slots and configure the tables and seats available for each one.
- **MH-03 — Receive confirmation:** booking confirmation is displayed immediately; a confirmation email is attempted when Mailgun is configured. Email delivery failures do not cancel confirmed bookings.
- **MH-04 — Check availability:** public search by date, meal and number of guests; eligible time slots show their availability.
- **MH-05 — Provide party requirements:** hikers can enter separate dietary/allergy requirements, including the number of affected guests, when confirming a booking. The confirmation page shows the saved information.
- **My Bookings (team extension):** authenticated hikers can review their upcoming, past and cancelled reservations and open booking details. Viewing a booking does not currently provide editing or cancellation actions.
- **My Account (team extension):** hikers can update their name, phone, optional notes and emergency contact, change their password by supplying the current password, and upload/change/remove a profile photo. Changes persist in the database. The email address is shown read-only.
- **Authentication:** hiker registration and login/logout; access to staff and hiker endpoints is protected by the backend. A hiker cannot create a second confirmed booking for the same slot.

The staff **Reservations** page remains a placeholder. Other Mountain Hut stories, including full booking change/cancellation workflows, are not claimed as implemented here.

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

Without `DATABASE_URL`, the backend uses an **embedded PostgreSQL (PGlite)** stored in `backend/database/pglite`, so no database server is needed. On first startup it creates the schema and demo records. Existing databases are **not migrated**: after a schema change, reset with `npm run db:reset` (deletes your local data).

## Run with Docker

```bash
docker compose up --build
```

Open **http://localhost:8081**. This builds the backend and frontend images and starts PostgreSQL, the backend and nginx (which serves the frontend and forwards `/api`). `docker compose down -v` also deletes the database.

The Product Owner runs the **published** images from Docker Hub (`jenissevereau/mountain-hut-backend`, `jenissevereau/mountain-hut-frontend`) with [`deploy/compose.yaml`](deploy/compose.yaml) only; see [`deploy/README.md`](deploy/README.md). Images are built and pushed by [`.github/workflows/release.yml`](.github/workflows/release.yml) when a `v*` or `sprint-*` tag is pushed. If the SQL scripts changed since the previous release, the generated release notes tell the PO to run `docker compose down -v` (demo data is lost).

## Create demo meal slots (optional)

`backend/scripts/populate-slots.mjs` adds future meal slots without overwriting reservations, existing slots or their capacity. Stop the backend first, then from `backend/`:

```bash
npm run db:seed:slots -- --dry-run
npm run db:seed:slots
```

By default the script covers **tomorrow through 30 September 2027**, with breakfast, lunch, aperitif and dinner intervals. Use `--from=YYYY-MM-DD` and `--to=YYYY-MM-DD` to customize the range. It skips existing/overlapping intervals, including disabled slots. Inside Docker run it with `docker compose exec backend node scripts/populate-slots.mjs`. This script is for local development/demo data, not a required production job.

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
- [`backend/`](backend/) — REST API, authentication, slot and booking services, PostgreSQL persistence, Mailgun notifications and integration/unit tests. See its README for API routes and data tooling.

## Security and limitations

User identity is taken from the authenticated server-side session, not user IDs supplied by the browser. Booking capacity is checked again inside the write transaction. Uploaded profile photos are stored in the user's database record and served only to that signed-in account. Development sessions are stored in server memory and do not survive a restart.

The local database (`backend/database/`), credentials, generated files and dependencies should remain local and must not be committed to Git. Sessions are kept in backend memory, so restarting the backend container logs everyone out.

## License

**Mozilla Public License 2.0** — see [`LICENSE`](LICENSE). MPL 2.0 allows reuse and modification while retaining file-level copyleft for modified MPL-covered files distributed to others.
