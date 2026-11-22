# Running Mountain Hut Management (Product Owner guide)

You only need **Docker** and the two files in this folder: `compose.yaml` and `.env.example`.
No source code, Node.js or build step is required: the images are downloaded from
Docker Hub ([jenissevereau](https://hub.docker.com/u/jenissevereau)).

## Prerequisites
- Docker Desktop (Windows/macOS) or Docker Engine with the Compose plugin (Linux).
- Port 8081 free (or choose another one in `.env`).

## First run
1. Put `compose.yaml` and `.env.example` in an empty folder.
2. Copy `.env.example` to `.env` and set the values sent via zip folder.
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

## Considerations before testing the application

1. Make sure to have the .env in place at the root of the folder where the compose.yaml file exists.
2. Make sure all credentials were copied to the .env file.
3. The first time you run the system, user needs to log in as employee employee@hut.test and define the slots that will be available for the users to create bookings.
4. Emails could be sent to the spam folder. Make sure to check spam folder.
