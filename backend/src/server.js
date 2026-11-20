import { createApp } from './app.js';
import { config } from './config/config.js';
import { createDb, describeDb } from './db/index.js';
import { createEmailServiceFromConfig } from './services/emailService.js';

const db = createDb({ databaseUrl: config.databaseUrl, pgliteDir: config.pgliteDir });

// Fail fast if the database is unreachable; creates the schema on first start.
try {
  await db.ready();
} catch (err) {
  console.error(`Cannot connect to the database (${describeDb(config)}):`, err.message);
  process.exit(1);
}

const emailService = createEmailServiceFromConfig(config);
const app = createApp({ db, emailService });

if (emailService.isEnabled()) {
  // Fire-and-forget: a Mailgun outage must not prevent the API from starting.
  emailService.verifyTemplates()
    .then(({ templates }) => {
      const missing = templates.filter((t) => !t.ok);
      if (missing.length) {
        console.error(
          'Mailgun templates missing or without an active version:',
          missing.map((t) => `${t.name} (status ${t.status ?? 'n/a'})`).join(', ')
        );
      } else {
        console.log('Mailgun templates verified:', templates.map((t) => `${t.name}=${t.active}`).join(', '));
      }
    })
    .catch((err) => console.error('Cannot verify Mailgun templates:', err.message));
}

const server = app.listen(config.port, () => {
  console.log(`Mountain Hut backend listening on http://localhost:${config.port} – database: ${describeDb(config)}`);
});

// Close the HTTP server and the database cleanly on Ctrl+C / docker stop
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => db.close().then(() => process.exit(0)));
  });
}
