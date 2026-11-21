import { defineConfig } from "cypress";

// `npm run e2e` starts the isolated in-memory backend (port 8090) and a
// Vite server in e2e mode (port 5174), runs Cypress, then stops both.
// Specs create their own slots, so no database reset task is needed.
export default defineConfig({
  e2e: {
    baseUrl: "http://127.0.0.1:5174",
  },
});
