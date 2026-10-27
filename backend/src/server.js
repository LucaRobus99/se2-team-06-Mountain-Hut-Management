import { createApp } from './app.js';
import { config } from './config/config.js';
import { createSqliteDb } from './db/sqlite.js';

const db = createSqliteDb(config.sqliteFile);
const app = createApp({ db });

const server = app.listen(config.port, () => {
  console.log(`Mountain Hut backend listening on http://localhost:${config.port} – database: ${config.sqliteFile}`);
});

// Close the HTTP server and the database cleanly on Ctrl+C
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => db.close().then(() => process.exit(0)));
  });
}
