/**
 * App settings. Every value can be overridden with an environment variable,
 * but the defaults work out of the box.
 */
const isProduction = process.env.NODE_ENV === 'production';

/** Trimmed non-empty env value, or the fallback (protects against empty/space values). */
function envText(name, fallback) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set when NODE_ENV=production.');
}

export const config = {
  port: Number(process.env.PORT ?? 8080),

  /**
   * PostgreSQL connection string, e.g. postgres://user:pass@db:5432/mountain_hut.
   * Set by docker compose. When empty, an embedded PostgreSQL (PGlite) stored in
   * `pgliteDir` is used instead, so `npm run dev` works without Docker.
   */
  databaseUrl: process.env.DATABASE_URL || null,
  pgliteDir: process.env.PGLITE_DIR ?? 'database/pglite',

  /** IANA time zone used to interpret slot dates/times (hut local time). */
  hutTimeZone: process.env.HUT_TIMEZONE ?? 'Europe/Rome',

  /** Secret used to sign the session cookie. Always set it in production. */
  sessionSecret: process.env.SESSION_SECRET ?? 'mountain-hut-dev-secret',

  /** Mailgun settings used to send booking confirmation emails. */
  mailgunApiKey: (process.env.MAILGUN_API_KEY || process.env.API_KEY || '').trim() || null,
  mailgunDomain: envText('MAILGUN_DOMAIN', '').toLowerCase() || null,
  mailgunFrom: envText('MAILGUN_FROM', null),
  mailgunTemplate: envText('MAILGUN_TEMPLATE', 'booking-confirmation'),
  /** MH-06 (#41): Mailgun template sent after a hiker changes a booking. */
  mailgunUpdatedTemplate: envText('MAILGUN_UPDATED_TEMPLATE', 'booking-modification'),
  /** MH-08 (#41): Mailgun template sent after a hiker cancels a booking. */
  mailgunCancelledTemplate: envText('MAILGUN_CANCELLED_TEMPLATE', 'booking-cancelled'),
  /** MH-07 (#44): Mailgun template for the password reset link. */
  mailgunResetTemplate: envText('MAILGUN_RESET_TEMPLATE', 'password reset'),
  /** EU accounts must use https://api.eu.mailgun.net; US accounts may leave it empty. */
  mailgunUrl: (() => {
    const value = envText('MAILGUN_URL', '');
    return value ? value.replace(/\/+$/, '') : null;
  })(),

  /** Public frontend URL used to build password reset links (#44). */
  appBaseUrl: envText('APP_BASE_URL', 'http://localhost:5173'),

  isProduction,

  /**
   * Send the session cookie only over HTTPS. Defaults to true in production;
   * set COOKIE_SECURE=false when the app is served over plain HTTP (e.g. the
   * docker compose demo on http://localhost), otherwise login silently fails.
   */
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction,
};