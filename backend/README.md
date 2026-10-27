# Mountain Hut Management – Backend

Node.js · Express 5 · SQLite (built into Node.js) · Vitest + Supertest

## Getting started
Requires Node.js **22.13 or newer**. Nothing else: the database is a single file created automatically.

```
npm install
npm run dev
```
The API listens on http://localhost:8080. `npm run dev` restarts the server automatically when you save a file.

The first start creates `database/database.sqlite` with the tables and sample data from `scripts/*.sql`. Data stays between restarts. To start again from the sample data, stop the server and run:
```
npm run db:reset
```

| Script             | What it does                                       |
|--------------------|----------------------------------------------------|
| `npm run dev`      | Start with auto-restart on file changes            |
| `npm start`        | Start normally                                     |
| `npm run db:reset` | Delete the database file (recreated on next start) |
| `npm test`         | Run backend tests with Vitest                      |

## Configuration
Defaults work out of the box. Override with environment variables (see `.env.example`):

- `PORT` – default `8080`
- `SQLITE_FILE` – default `database/database.sqlite` (`:memory:` = temporary database, lost on restart)

## Database
- `scripts/01-schema.sql` creates the tables, `scripts/02-seed.sql` inserts sample data.
- They run automatically when the backend starts and the database file has **no tables yet**.
- After changing a script, run `npm run db:reset` so the database is recreated from it.
- To look inside the database file, use a free viewer such as [DB Browser for SQLite](https://sqlitebrowser.org/) or a SQLite viewer extension in VS Code.

| Table           | Holds                                                    | Stories      |
|-----------------|----------------------------------------------------------|--------------|
| `huts`          | Huts (the model supports several; the MVP shows one)     | all          |
| `users`         | Hikers (self-registered) and staff (seeded, linked to a hut) | login task, MH-02 |
| `dining_tables` | Each table of a hut with its own number of seats         | MH-02        |
| `slots`         | Date + start time, status `available` / `off`            | MH-02, MH-04 |
| `slot_tables`   | Which tables a slot uses (pending clarification issue 7) | MH-02        |
| `bookings`      | Party size, contact email (always required), status      | MH-01, MH-03 |
| `booking_seats` | Seats a booking takes at each table (shared / split tables) | MH-01     |

Free seats of a table in a slot = its `seats` minus the `booking_seats` of confirmed bookings in that slot.

Sample accounts (`scripts/02-seed.sql`): `warden@hut.test`, `employee@hut.test`, `hiker@hut.test`. Their `password_hash` is a placeholder until the registration/login task chooses a hashing method.

### Transactions (bookings)
Any write that depends on a check, such as "are there enough free seats? then insert the booking", must run inside `db.transaction`:

```js
await db.transaction(async (tx) => {
  const free = await bookingDao.countFreeSeats(tx, slotId);
  if (free < partySize) throw new ConflictError('Not enough seats');
  await bookingDao.insert(tx, booking);
});
```
Transactions run one at a time, so when two hikers book the last seats together, the first one saved wins and the second gets the error (AC-01.9). If the function throws, nothing is saved.

## Layers

```
src/
├── server.js              starts the HTTP server
├── app.js                 builds the Express app and wires the layers together
├── config/config.js       settings (port, database file)
├── db/sqlite.js           database connection + transaction helper; creates the schema on first start
├── routes/                WEB layer: URL → service call → HTTP status/JSON
│   └── healthRoutes.js
├── services/              SERVICE layer: business rules + validation (no HTTP, no SQL)
├── dao/                   DAO layer: the only place with SQL
├── errors/AppError.js     ValidationError (400), UnauthorizedError (401), ForbiddenError (403),
│                          NotFoundError (404), ConflictError (409)
└── middleware/errorHandler.js   turns errors into JSON responses
scripts/                   schema + seed SQL scripts
test/                      backend tests (in-memory SQLite or mocked database)
├── unit tests/black box/  endpoint tests through HTTP
└── unit tests/white box/  tests of single modules
```

Calls only go downward: `routes → services → dao → database`.

## Endpoints
| Method | Path          | Description                       |
|--------|---------------|-----------------------------------|
| GET    | `/api/health` | `{"status":"UP","database":"UP"}` |

Story endpoints (slots, availability, bookings) will be added during the sprint.

Errors are returned as JSON with `type`, `title`, `status` and `detail`. For example, a missing route returns:
```json
{ "type": "about:blank", "title": "Not Found", "status": 404, "detail": "No route for GET /api/unknown" }
```

## Adding a new feature (e.g. MH-02 slots)
1. If needed, change `scripts/01-schema.sql` (and sample data in `scripts/02-seed.sql`), then `npm run db:reset`
2. `src/dao/slotDao.js` – SQL queries (placeholders `$1, $2…`)
3. `src/services/slotService.js` – rules and validation, throwing errors from `errors/AppError.js`
4. `src/routes/slotRoutes.js` – endpoints
5. Wire the new router in `src/app.js` using the existing database connection
6. Add tests in `test/` and run `npm test`

Note: the tables for MH-01 to MH-04 already exist in `scripts/01-schema.sql`; do not recreate them.
