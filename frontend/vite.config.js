import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Requests to /api are forwarded to the existing Express backend.
    // This avoids configuring CORS for local development.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});
