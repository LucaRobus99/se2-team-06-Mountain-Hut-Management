# Mountain Hut Management — Frontend skeleton (MHM-16)

React + Vite (JavaScript/JSX), React Router, Bootstrap and React-Bootstrap.

This directory is meant to live **beside `backend/`** in the existing team repository.
No existing backend files need to be replaced.

## Requirements

Node.js 22.13+ (the backend requires the same minimum version) and npm.

## Start the frontend

From the team repository:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173/. For production build: `npm run build`.

To run the existing backend, in a **second terminal**:

```bash
cd backend
npm install
npm run dev
```

The backend listens on http://localhost:8080. Vite proxies `/api/*` to that
backend, so future frontend requests can use paths such as `fetch('/api/health')`.
There is **no login/session implementation yet** and the story-specific
endpoints are **not implemented** in the uploaded backend.

## Pages and responsibilities

| Route | Page | Owner / task |
|---|---|---|
| `/` | Home | Skeleton page; hut-specific location/details TBD |
| `/availability` | Availability | Gaia, MHM-4 — public (placeholder) |
| `/book` | Booking | Gaia, MHM-1 — hiker (placeholder) |
| `/staff/slots` | Slot configuration | Gaia, MHM-2 — employee (placeholder) |
| `/login` | Login | Gaia, separate horizontal task (placeholder) |
| `*` | Not found | Generic fallback page |

In `src/main.jsx`, `BrowserRouter` wraps the application.
`src/App.jsx` declares its routes. `src/layouts/MainLayout.jsx` uses `Outlet`
for shared navigation and footer. `src/components/` holds reusable UI elements;
`src/pages/` contains individual page components. `src/api/` is kept for
future Fetch API helpers **after Luca and the team finish the API contract**.

## Important scope boundaries

- **MHM-16 is only the skeleton and routing.** The booking/availability/slot
  forms and the login page are future tasks, so their pages display honest
  placeholders instead of fake working functionality.
- `/book` and `/staff/slots` are **not guarded yet**. The team should add
  authentication/authorization and route guards during the separate tasks.
  The Express backend must independently enforce roles and permissions.
- Do not hard-code private credentials, invent hut location/details, or
  commit `node_modules/` or `.env` files.
- The backend schema already contains tables for the first stories; frontend
  work must not duplicate database logic.

## Suggested next task order

1. Agree on the API endpoints and data formats (MHM-20).
2. Implement login and session management in its separate task.
3. Replace placeholders one at a time with React forms, using Fetch API.
4. Keep error handling consistent with the backend's JSON error shape:
   `type`, `title`, `status`, `detail`.
