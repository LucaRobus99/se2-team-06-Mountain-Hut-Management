# Edelweiss Hut — Frontend

**Stack:** React 19, Vite 7, React Router 7 and Bootstrap/React-Bootstrap. The frontend connects to the real Express/SQLite backend using authenticated sessions; no mocked booking or account data is used in the application.

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

Open `http://localhost:5173`. Vite proxies `/api` requests to `http://localhost:8080` (backend default). Use `npm start` for the backend during manual testing to avoid watch-mode restarts losing the login session.

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
| `/staff/reservations` | Placeholder (not yet implemented) | Employee/Warden |

`/about` redirects to `/find-us`.

## Booking flow (MH-01, MH-03, MH-04, MH-05)

Visitors search by **date, meal and guest count** on the availability page. Selecting a slot starts the booking flow. If the visitor is not signed in, the app asks them to log in/register before booking.

The review page shows the selected time, party size and seating proposal. Hikers can add multiple **dietary requirements/allergies** with the affected number of guests. Before opening the review, the application checks whether this user already has a confirmed booking in the selected slot; the backend also rejects duplicates when the booking is actually submitted.

On successful submission, the confirmation page shows the booking reference, time, seating, any stored dietary requirements and the email outcome. It states that an email was sent **only if** the backend reports `confirmationEmail.status === 'sent'`. Email failure never makes a confirmed booking disappear.

## My Bookings

`src/pages/MyBookingsPage.jsx` loads the authenticated hiker's reservations using `GET /api/bookings` and groups them into **upcoming**, **past** and **cancelled**. No reservation is selected initially. The arrow on each card toggles a detail panel without showing table identifiers. On smaller screens the detail/edit panel replaces the list and a Back button restores it. Full details include a link back to My Bookings.

For eligible upcoming reservations, **Change booking** opens `EditBookingForm.jsx` (MHM-116). Date, meal and guest count trigger the same availability lookup used by the booking page; available times appear as photographic slot cards. The original slot remains selectable because public availability counts its seats as occupied, and the backend rechecks/reallocates seats transactionally on `PATCH /api/bookings/:bookingId`. Multiple dietary/allergy requirements can be edited. The 48-hour cutoff is displayed in the UI and enforced by the backend. Past/cancelled bookings are history only; hiker cancellation (MH-08) is not implemented.

## My Account

`src/pages/MyAccountPage.jsx` provides a personal area with:

- Profile photo: click the avatar itself to **upload/change/remove** a photo; JPG, PNG and WebP files are supported. `src/utils/avatar.js` crops/resizes large images in the browser before upload.
- Personal information: update **name, phone, optional notes and emergency contact** and see the saved details after refreshing the page. Email is read-only.
- Password & Security: provide the current password and a new one, then confirm it.

Profile edits, password changes and photo operations call the real backend endpoints in `src/api/auth.js`. `AuthContext.jsx` refreshes the signed-in user after updates so the navbar reflects new names/photos. The photo is persisted in SQLite, not only in browser memory.

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

Run Cypress E2E tests against an actively running backend/frontend when validating the full flow; the existing scenarios are in `cypress/e2e/`. The production build was verified on 12 November 2026, but every new change should be tested again.

## Known scope limits

The staff Reservations page, hiker booking cancellation (MH-08) and production email delivery setup are outside the currently completed UI. Full MH-06 end-to-end validation and additional backend PATCH tests are still needed. Mailgun keys must remain in the backend `.env` and must never be included in frontend code.
