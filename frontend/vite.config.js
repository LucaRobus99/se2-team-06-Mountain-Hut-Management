import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `vite --mode e2e` (used by `npm run e2e`) forwards /api to the isolated
// test backend on 8090 instead of the regular backend on 8080.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    // Requests to /api are forwarded to the existing Express backend.
    // This avoids configuring CORS for local development.
    proxy: {
      '/api': mode === 'e2e' ? 'http://127.0.0.1:8090' : 'http://localhost:8080',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './test/setupTests.js',
    coverage: {
      provider: 'v8', // oppure 'istanbul' se usi quello nel progetto
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: [
        'src/main.jsx',
        'src/index.jsx',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        'test/**',
      ],
    },
  },
}));
