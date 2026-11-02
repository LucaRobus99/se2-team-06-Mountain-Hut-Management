# se2-team-06-Mountain-Hut-Management


## License Motivation
We chose the Mozilla Public License 2.0 because we want Mountain Hut to be used and improved by anyone. We don't want to limit those who want to customize it or develop new features, but we think it's fair that modifications to our original code remain available to others when distributed. At the same time, we don't want to force developers to share all the additional code they create independently.


## Local development

Requires Node.js 22.13 or newer. Start the backend and frontend in separate terminals:

```sh
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

The public booking availability page is at `/availability`. Hikers can use `/register` to create an account (name, email, mobile number, plus optional notes and emergency contact). Successful registration starts a session, so they can continue a pending booking. See [backend/README.md](backend/README.md) for the current routes and local database setup.
