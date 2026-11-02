# Mountain Hut Management – Backend

**Stack:** Node.js 22.13+, Express 5, native `node:sqlite`, Passport local authentication with `express-session`.

## Run locally

```sh
cd backend
npm install
npm run dev
```

The backend listens on `http://localhost:8080`. The frontend Vite dev server proxies `/api` to port 8080.
The initial database is created automatically from `scripts/01-schema.sql` and `02-seed.sql`.

If you already have **an old local SQLite database** from an earlier schema, back it up first and then run `npm run db:reset` while the server is stopped. This deletes the local SQLite database and recreates the example data at next startup. **Do not reset a database containing data you need to keep.** Newly added Hiker profile columns are migrated automatically for databases already using the current slot schema.

## Current endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | Public | Health check |
| `POST` | `/api/auth/register` | Public | Create a Hiker account and sign in |
| `POST` | `/api/auth/login` | Public | Sign in |
| `GET` | `/api/auth/me` | Authenticated | Current user |
| `POST` | `/api/auth/logout` | Authenticated | Sign out |
| `GET` | `/api/availability` | Public | Available slots for date, meal, partySize (MH-04) |
| `GET` | `/api/availability/:slotId/seating` | Public | Seat preview (MH-01) |
| `POST` | `/api/bookings` | Authenticated | Create booking (MH-01) |
| `GET` | `/api/bookings/:bookingId` | Authenticated | Read booking |
| `GET`, `POST` | `/api/slots` | Staff as applicable | Work in progress for MH-02 |

Registration fields: `name`, `email`, `phone`, `password` are required; `notes` and `emergencyContact` are optional. Only the `hiker` role can self-register. Passwords are stored as salted `scrypt` hashes, never returned to clients. Successful registration returns `201 { "user": ... }` and a session cookie (`sid`). Existing staff accounts remain seeded.

The current app manages **one hut**; slot capacities come from `slot_tables` and booking assignments from `booking_seats`. Slots without assigned tables offer zero seats. Error responses are JSON of the form `{ "error": { "code": "...", "message": "...", "details": [...] } }`.

## Testing

```sh
npm test
# Dependency-light focused tests for SQL, registration, MH-01 and MH-04:
node --disable-warning=ExperimentalWarning --test test/registration.booking.node.test.mjs
```

For Vitest on another operating system, run `npm install` locally to install its platform-specific native dependencies (do not copy `node_modules` from Windows to Linux or vice versa).

## Notes

- The SQLite wrapper binds `$1`, `$2`, ... as **named parameters**, including when one is repeated in a query, to avoid the Node 22 `column index out of range` error.
- Local development uses session storage in memory: sessions end when the server restarts. In production set `SESSION_SECRET` in the environment and use a persistent session store if running multiple instances.
- Follow the official Mountain Hut user stories and recorded Product Owner clarifications for business rules.
