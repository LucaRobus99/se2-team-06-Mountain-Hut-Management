# Running Mountain Hut Management (Product Owner guide)

You only need **Docker** and the two files in this folder: `compose.yaml` and `.env.example`.
No source code, Node.js or build step is required: the images are downloaded from
Docker Hub ([jenissevereau](https://hub.docker.com/u/jenissevereau)).

## Prerequisites
- Docker Desktop (Windows/macOS) or Docker Engine with the Compose plugin (Linux).
- Port 8081 free (or choose another one in `.env`).

## First run
1. Put `compose.yaml` and `.env.example` in an empty folder.
2. Copy `.env.example` to `.env` and set `POSTGRES_PASSWORD` and `SESSION_SECRET`.
3. In that folder run:
   ```bash
   docker compose pull
   docker compose up -d
   ```
4. Open <http://localhost:8081>. The first start creates the database and demo data (about 10 seconds).

## Demo accounts
All three use the password `password`.

| Role | Email |
|---|---|
| Warden | `warden@hut.test` |
| Employee | `employee@hut.test` |
| Hiker | `hiker@hut.test` |

Hikers can also register from the app.

## Everyday commands
| What | Command |
|---|---|
| Stop (data is kept) | `docker compose down` |
| Start again | `docker compose up -d` |
| See logs | `docker compose logs -f backend` |
| Reset to fresh demo data | `docker compose down -v` then `docker compose up -d` |

## Upgrading to a new release
1. Download the new release's `compose.yaml` (or set `MOUNTAIN_HUT_VERSION` in `.env`).
2. **Read the release notes.** If they say **"Schema change: yes"**, the database must be
   recreated, and all data entered so far is lost:
   ```bash
   docker compose down -v
   ```
3. Then:
   ```bash
   docker compose pull
   docker compose up -d
   ```

Releases without a schema change keep all data.

## Troubleshooting
- **Login does nothing / you are logged out immediately:** keep `COOKIE_SECURE` unset (or `false`)
  when using `http://`. Set it to `true` only behind HTTPS.
- **"port is already allocated":** change `APP_PORT` (and `APP_BASE_URL`) in `.env`.
- **The backend keeps restarting:** run `docker compose logs backend`. If it mentions a missing
  column or table after an upgrade, the release changed the schema: run `docker compose down -v`.
- **No emails arrive:** emails are only sent when the `MAILGUN_*` values are set in `.env`.
  Check that the configured templates exist on the Mailgun domain with an active version,
  and inspect delivery events, without the dashboard:
  ```bash
  docker compose exec backend npm run mailgun:templates -- --status
  docker compose exec backend npm run mailgun:templates -- --events
  ```
  Upload/update the templates shipped in the image when needed:
  ```bash
  docker compose exec backend npm run mailgun:templates -- --only=created,updated,cancelled
  ```
  The backend also verifies the templates at startup: `docker compose logs backend` shows
  `Mailgun templates verified: …` or the missing names. After changing `.env`, recreate the
  backend so the new values are loaded: `docker compose up -d --force-recreate backend`.

