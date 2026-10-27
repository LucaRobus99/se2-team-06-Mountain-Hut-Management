/**
 * App settings. Every value can be overridden with an environment variable,
 * but the defaults work out of the box.
 */
export const config = {
  port: Number(process.env.PORT ?? 8080),

  /** SQLite database file. ":memory:" = temporary database in RAM (lost on restart). */
  sqliteFile: process.env.SQLITE_FILE ?? 'database/database.sqlite',
};
