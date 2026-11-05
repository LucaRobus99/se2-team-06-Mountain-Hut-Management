# Edelweiss Hut — Frontend

**Stack:** React 19, Vite, React Router 7, Bootstrap/React-Bootstrap.

The frontend is functional for the Sprint 1 stories (MH-01 to MH-04). This is **not** the former MHM-16 placeholder skeleton: login, registration, public availability, booking confirmation and staff slot management are implemented.

## Run

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. In another terminal, run `cd backend && npm run dev` from the repository root. Vite proxies `/api` to `http://localhost:8080`.

## Routes and pages

| Route | Page | Access |
| --- | --- | --- |
| `/` | General hut homepage | Public |
| `/find-us` | Location / how to get there | Public |
| `/menu` | Menu page | Public |
| `/availability` | Check availability (redirects logged-in Hikers to `/book`) | Public |
| `/register` | Register a Hiker | Public |
| `/login` | Log in | Public |
| `/book` | Search available slots; review and confirm a booking after selection | Hiker |
| `/staff` | Staff dashboard | Employee/Warden |
| `/staff/slots` | Create/list slots and table capacity | Employee/Warden |
| `/staff/reservations` | Not yet implemented | Employee/Warden |

The booking review UI is `src/pages/BookingPage.jsx`. After `POST /api/bookings`, it shows the booking reference and **only claims that the email was sent if the backend returned `confirmationEmail.status === 'sent'`**. On `failed`/`skipped`, the booking still succeeds and the user is asked to keep the reference. The visual styles live in `src/styles/edelweiss-pages.css`.

`src/api/booking.js`, `src/api/slots.js` and `src/api/auth.js` hold the API clients. `src/auth/AuthContext.jsx` owns session state; protected routes guard the UI, and the backend independently enforces permissions.

## Current scope limits

- The public availability search uses `date + meal + partySize` and then lists eligible time slots; a separate exact-time search is not exposed.
- Hiker-supplied dietary/party requirements (MH-05) are not yet implemented, so no such details appear in outgoing emails.
- Do not expose Mailgun keys in frontend code; configuration belongs exclusively to the backend.
- Existing Cypress and other automated tests are intentionally **not updated by this patch**; their current status must be checked separately before the Definition of Done.
