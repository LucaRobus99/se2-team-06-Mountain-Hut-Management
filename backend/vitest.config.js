import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Builds the seeded PGlite template used by test/helpers/testDb.js.
    globalSetup: ['./test/globalSetup.js'],
    env: { NODE_ENV: 'test' },
    // Starting embedded PostgreSQL takes a few seconds per test file.
    hookTimeout: 180_000,
    testTimeout: 30_000,
    coverage: {
      provider: 'v8', // oppure 'istanbul' se usi quello
      include: ['src/**/*.js'],
    },
  },
});