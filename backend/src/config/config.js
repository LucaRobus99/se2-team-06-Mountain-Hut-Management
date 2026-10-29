/**
 * App settings. Every value can be overridden with an environment variable,
 * but the defaults work out of the box.
 */
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set when NODE_ENV=production.');
}

export const config = {
  port: Number(process.env.PORT ?? 8080),

  /** SQLite database file. ":memory:" = temporary database in RAM (lost on restart). */
  sqliteFile: process.env.SQLITE_FILE ?? 'database/database.sqlite',

  /** IANA time zone used to interpret slot dates/times (hut local time). */
  hutTimeZone: process.env.HUT_TIMEZONE ?? 'Europe/Rome',

  /** Secret used to sign the session cookie. Always set it in production. */
  sessionSecret: process.env.SESSION_SECRET ?? 'mountain-hut-dev-secret',

  isProduction,
};
