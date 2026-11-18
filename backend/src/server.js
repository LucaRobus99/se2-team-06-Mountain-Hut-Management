import { createApp } from './app.js';
import { config } from './config/config.js';
import { createDb, describeDb } from './db/index.js';

const db = createDb({ databaseUrl: config.databaseUrl, pgliteDir: config.pgliteDir });

// Fail fast if the database is unreachable; creates the schema on first start.
try {
  await db.ready();
} catch (err) {
  console.error(`Cannot connect to the database (${describeDb(config)}):`, err.message);
  process.exit(1);
}

const app = createApp({ db });

const server = app.listen(config.port, () => {
  console.log(`Mountain Hut backend listening on http://localhost:${config.port} – database: ${describeDb(config)}`);
});

// Close the HTTP server and the database cleanly on Ctrl+C / docker stop
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => db.close().then(() => process.exit(0)));
  });
}
