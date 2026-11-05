# Edelweiss Hut — Mountain Hut Management

Software Engineering II · Team 06 · Sprint 1 (MH-01, MH-02, MH-03, MH-04).

The application currently manages **one mountain hut**. The frontend is **React + Vite + React Router + Bootstrap**; the backend is **Node.js (22.13+) + Express 5 + SQLite (`node:sqlite`)**, with Passport Local session authentication.

## Implemented Sprint 1 features

- **MH-01 — Book a table:** authenticated Hikers choose an available slot and party size; the backend allocates seats at a single table when possible, otherwise across the fewest tables.
- **MH-02 — Define slot capacity:** Employees/Wardens create future slots with flexible start and end times, configure individual tables/seats or copy a previous slot's table layout.
- **MH-03 — Receive confirmation:** booking confirmation is sent via Mailgun when configured; sending failures do **not** cancel a booking. The confirmation page reports whether the email request was accepted.
- **MH-04 — Check availability:** public date/meal/party-size search, displaying seat availability and split seating options without login.
- **Authentication:** Hiker registration and login/logout; role-protected staff functionality.

The **Reservations** management page and later Mountain Hut stories are outside this first-sprint scope.

## Run locally

Node.js >=22.13 and npm are required. Work from the repository root.

**Terminal 1 — backend**

```bash
cd backend
npm install
# Copy .env.example to .env and configure Mailgun if email delivery is needed.
npm run dev
```

**Terminal 2 — frontend**

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The API is on `http://localhost:8080`, with a Vite proxy from `/api/*`.

The backend creates a local SQLite database if it does not exist. **Do not run `npm run db:reset` unless you explicitly want to delete your local data.** Before a demo, verify the local data and email configuration.

## Project structure

- `backend/` — API, authentication, persistence and email notifications.
- `frontend/` — React application and user interfaces.

Each component has its own README with local setup and implementation notes.

## License

**Mozilla Public License 2.0** (see [`LICENSE`](LICENSE)). We chose MPL 2.0 so the project can be used, adapted and extended while modifications to MPL-covered source files remain available on distribution. Independent additional code can be licensed separately, consistent with MPL 2.0's file-level copyleft.

## Notes on scope and quality

- Slot starting times/durations are flexible. The current code prohibits overlapping slots on the same date, but the professor has **not yet confirmed this rule**.
- This documentation describes the implementation, not evidence of completed unit/integration/E2E tests or code review. These checks must be tracked separately against the Definition of Done.
- Do not commit Mailgun keys, `backend/.env`, `node_modules/` or generated local databases.
