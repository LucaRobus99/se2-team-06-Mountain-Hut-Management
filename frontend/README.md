# Edelweiss Hut — Frontend

**Stack:** React 19, Vite 7, React Router 7 and Bootstrap/React-Bootstrap. The frontend connects to the real Express/PostgreSQL backend using authenticated sessions; no mocked booking or account data is used in the application.

## Run locally

From the repository root, run the backend and frontend in separate terminals:

```bash
cd backend
npm install
npm start
```

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. In Docker, the production build is served by nginx (`nginx.conf`), which also forwards `/api` to the backend container; see the root README. Vite proxies `/api` requests to `http://localhost:8080` (backend default). Use `npm start` for the backend during manual testing to avoid watch-mode restarts losing the login session.

## Routes

| Route | Page | Access |
| --- | --- | --- |
| `/` | Home page | Public |
| `/find-us` | Location, directions and surrounding area | Public |
| `/menu` | Menu information | Public |
| `/availability` | Date/meal/party-size search and available slots | Public |
| `/register` | Hiker registration | Public |
| `/login` | Login | Public |
| `/book` | Selection or booking review/confirmation flow | Hiker when booking |
| `/book/confirmation/:bookingId` | Saved booking confirmation/details | Hiker |
| `/my-bookings` | Upcoming, past and cancelled bookings | Hiker |
| `/my-account` | Profile/photo management and password security | Hiker |
| `/staff` | Staff dashboard | Employee/Warden |
| `/staff/slots` | Create/list meal slots and configure tables/seats | Employee/Warden |
| `/staff/reservations` | Create reservations for registered, temporary or new hikers | Employee/Warden |
| `/change-password` | Mandatory first-login password replacement | Restricted authenticated account |
| `/forgot-password` | Request a password reset email | Public |
| `/reset-password?token=…` | Set a new password using a valid reset link | Public |

`/about` redirects to `/find-us`.

## Booking flow (MH-01, MH-03, MH-04, MH-05)

Visitors search by **date, meal and guest count** on the availability page. Selecting a slot starts the booking flow. If the visitor is not signed in, the app asks them to log in/register before booking.

The review page shows the selected time, party size and seating proposal. Hikers can add multiple **dietary requirements/allergies** with the affected number of guests. Before opening the review, the application checks whether this user already has a confirmed booking in the selected slot; the backend also rejects duplicates when the booking is actually submitted.

On successful submission, the confirmation page shows the booking reference, time, seating, any stored dietary requirements and the email outcome. It reports an email as queued when the backend reports `confirmationEmail.status === 'sent'` (provider accepted, not inbox delivery). Email failure never makes a confirmed booking disappear.

## My Bookings

`src/pages/MyBookingsPage.jsx` loads the authenticated hiker's reservations using `GET /api/bookings` and groups them into **upcoming**, **past** and **cancelled**. No reservation is selected initially. The arrow on each card toggles a detail panel without showing table identifiers. On smaller screens the detail/edit panel replaces the list and a Back button restores it. Full details include a link back to My Bookings.

For eligible upcoming reservations, **Change booking** opens `EditBookingForm.jsx` (MHM-116). Date, meal and guest count refresh the owner-only modification availability endpoint; the existing photographic slot cards show only eligible times for the group. The original time remains selectable only while it fits, and an unavailable selection must be changed before saving. A failed lookup prevents saving and can be retried. The backend rechecks/reallocates seats transactionally on `PATCH /api/bookings/:bookingId`. Multiple dietary/allergy requirements can be edited. The 48-hour cutoff is displayed in the UI and enforced by the backend. Past/cancelled bookings remain accessible as history.

The edit form shares the public Availability cards and their table counts and status colours. Selecting a split slot opens the same seating confirmation modal as a new booking; if a guest-count change makes the existing selected slot split, saving also requires confirmation. The booking is updated only by saving. If a single-table allocation becomes split before saving, the server rejects the update and the form refreshes availability.

**Cancel booking** (MHM-124 / MH-08) is available for every confirmed reservation, including past reservations. A centered modal blocks interaction with the page until the hiker keeps the booking or confirms cancellation. Explicit confirmation calls `DELETE /api/bookings/:bookingId`; on success the reservation moves to Cancelled, preserving its details. Cancelled receipts omit seating because no seats remain reserved. The interface reports the cancellation email outcome and never changes the displayed status before server success.

## My Account

`src/pages/MyAccountPage.jsx` provides a personal area with:

- Profile photo: click the avatar itself to **upload/change/remove** a photo; JPG, PNG and WebP files are supported. `src/utils/avatar.js` crops/resizes large images in the browser before upload.
- Personal information: update **name, phone, optional notes and emergency contact** and see the saved details after refreshing the page. Email is read-only.
- Password & Security: provide the current password and a new one, then confirm it.

Profile edits, password changes and photo operations call the real backend endpoints in `src/api/auth.js`. `AuthContext.jsx` refreshes the signed-in user after updates so the navbar reflects new names/photos. The photo is persisted in the database, not only in browser memory.

The profile design uses the same forest-green, sage and cream palette as the rest of the site, with small inline SVG icons and a photo menu accessible by clicking the avatar.

## Frontend organization

- `src/pages/` — public, booking, personal and staff pages.
- `src/components/` — reusable navigation, booking controls and interface icons.
- `src/api/` — HTTP clients for auth, booking and staff slots.
- `src/auth/AuthContext.jsx` — session state shared between pages.
- `src/styles/` — global palette and page-level styling.
- `src/utils/avatar.js` — browser photo normalization and size validation.

Protected routes improve navigation, but **the backend is responsible for authorization**. Never trust client-supplied user IDs for bookings or profile changes.

## Validation and production build

```bash
cd frontend
npx vitest run
npm run build
```

End-to-end tests: run `npm run e2e` (see [End-to-end tests](#end-to-end-tests-cypress)). The production build was verified on 12 November 2026, but every new change should be tested again.

## Known scope limits

Staff Reservations uses an explicit first availability search, live updates after changes, and explicit slot selection. Split seating is confirmed once per selection. The confirmation page shows an initial password only for a new hiker, never persisted in browser storage. Mailgun keys must remain in the backend `.env` and must never be included in frontend code.

### End-to-end tests (Cypress)

From `frontend/`, one command runs every spec in `cypress/e2e/`:

```bash
npm run e2e        # headless, all specs
npm run e2e:open   # interactive Cypress window
```

It starts a throwaway backend (`backend/scripts/start-e2e-server.mjs`, fresh in-memory PostgreSQL with the seed data, no Mailgun) on port **8090** and a Vite server in `e2e` mode on port **5174** that forwards `/api` to it, waits until both answer, runs Cypress, then stops both. Your regular backend (8080) and `npm run dev` (5173) can keep running and are never touched; every run starts from a clean database, so no restart or reset is needed. To run a single spec, use `npm run e2e:open` and pick it in the Cypress window.

Each spec first calls `/api/e2e` and stops unless the isolated server answers, then creates its own slots on a free future date (helpers in `cypress/support/hutFixtures.js`).

| Spec | Covers |
|---|---|
| `smoke`, `login`, `availability`, `booking`, `booking-auth` | MH-01/03/04: search, booking as guest → login, booking and confirmation, split seating |
| `change-booking` | MH-06: mobile change flow, refused capacity change keeps the booking |
| `cancel-booking` | MH-08: confirmation dialog, history after reload, released capacity |
| `staff-booking` | MH-07: all three staff booking modes and the forced first-login password change |

Real email delivery (confirmation, change, cancellation, password reset link) must still be checked manually with Docker and a valid Mailgun configuration.
