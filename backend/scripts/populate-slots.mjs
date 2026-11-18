/**
 * Development/demo data only: populate future meal slots without replacing
 * bookings, existing slots, their status, or any assigned seats.
 *
 * From backend/: npm run db:seed:slots -- --dry-run
 *                npm run db:seed:slots
 * Optional: --from=YYYY-MM-DD --to=YYYY-MM-DD
 * The default end date is 30 September 2027.
 *
 * The script uses the same database as the server: DATABASE_URL (PostgreSQL,
 * e.g. the docker compose db) or, when unset, the embedded database in
 * PGLITE_DIR (default database/pglite). With the embedded database, stop the
 * backend before running it (only one process can open it).
 * Inside Docker: docker compose exec backend node scripts/populate-slots.mjs
 */
import { config } from '../src/config/config.js';
import { createDb, describeDb } from '../src/db/index.js';

const TEMPLATE = [
  { meal: 'breakfast', start: '09:00', end: '10:00' },
  { meal: 'breakfast', start: '10:00', end: '11:00' },
  { meal: 'lunch', start: '12:00', end: '13:00' },
  { meal: 'lunch', start: '13:00', end: '14:00' },
  { meal: 'aperitivo', start: '16:00', end: '17:00' },
  { meal: 'dinner', start: '19:00', end: '20:00' },
  { meal: 'dinner', start: '20:00', end: '21:00' },
];

// Capacity is defined per slot, not globally (MH-02).
const SEATS_BY_LABEL = new Map([
  ['T1', 2], ['T2', 4], ['T3', 4], ['T4', 6], ['T5', 8],
]);

function tomorrowAtHut() {
  const hutToday = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return new Date(Date.parse(`${hutToday}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}

function parseArgs(args) {
  const options = { from: tomorrowAtHut(), to: '2027-09-30', dryRun: false };
  for (const arg of args) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--from=')) options.from = arg.slice('--from='.length);
    else if (arg.startsWith('--to=')) options.to = arg.slice('--to='.length);
    else throw new Error(`Unknown argument: ${arg}. Use --dry-run, --from=YYYY-MM-DD, --to=YYYY-MM-DD.`);
  }
  if (!validDate(options.from) || !validDate(options.to) || options.from > options.to) {
    throw new Error(`Invalid date range: ${options.from} to ${options.to}.`);
  }
  const days = Math.round((Date.parse(`${options.to}T00:00:00Z`) - Date.parse(`${options.from}T00:00:00Z`)) / 86_400_000) + 1;
  if (days > 730) throw new Error('For safety, generate no more than 730 days at a time.');
  return options;
}

function* datesBetween(from, to) {
  for (let ms = Date.parse(`${from}T00:00:00Z`), last = Date.parse(`${to}T00:00:00Z`);
    ms <= last; ms += 86_400_000) {
    yield new Date(ms).toISOString().slice(0, 10);
  }
}

function overlaps(existing, proposed) {
  // Includes OFF slots: we must never replace or overlap a disabled interval.
  return existing.some((slot) => slot.start < proposed.end && proposed.start < slot.end);
}

async function populate(db, { from, to, dryRun }) {
  const mealRows = (await db.query('SELECT id, meal_type FROM meals')).rows;
  const mealIds = new Map(mealRows.map((m) => [m.meal_type, m.id]));
  for (const item of TEMPLATE) {
    if (!mealIds.has(item.meal)) throw new Error(`Missing meal '${item.meal}' in database. No changes made.`);
  }
  const tables = (await db.query('SELECT id, label FROM dining_tables ORDER BY id')).rows
    .filter((table) => SEATS_BY_LABEL.has(table.label));
  if (!tables.length) throw new Error('No T1–T5 dining tables found. No changes made.');

  const result = { days: 0, added: 0, skipped: 0, tables: tables.length };
  result.byMeal = Object.fromEntries([...new Set(TEMPLATE.map((s) => s.meal))].map((meal) => [meal, 0]));
  for (const date of datesBetween(from, to)) {
    result.days++;
    const { rows } = await db.query('SELECT start_time, end_time FROM slots WHERE date = $1', [date]);
    const existing = rows.map((s) => ({ start: s.start_time, end: s.end_time }));
    for (const desired of TEMPLATE) {
      if (overlaps(existing, desired)) {
        result.skipped++;
        continue;
      }
      if (!dryRun) {
        const { rows: [slot] } = await db.query(
          `INSERT INTO slots (meal_id, date, start_time, end_time, status)
           VALUES ($1, $2, $3, $4, 'available') RETURNING id`,
          [mealIds.get(desired.meal), date, desired.start, desired.end]
        );
        for (const table of tables) {
          await db.query(
            'INSERT INTO slot_tables (slot_id, table_id, seats) VALUES ($1, $2, $3)',
            [slot.id, table.id, SEATS_BY_LABEL.get(table.label)]
          );
        }
      }
      existing.push(desired); // Also prevents overlap among slots generated in this run.
      result.added++;
      result.byMeal[desired.meal]++;
    }
  }
  return result;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const db = createDb({ databaseUrl: config.databaseUrl, pgliteDir: config.pgliteDir });
  try {
    // A dry run only reads; a real run is one transaction (all slots or none).
    const result = options.dryRun
      ? await populate(db, options)
      : await db.transaction((tx) => populate(tx, options));
    console.log(`${options.dryRun ? 'PREVIEW ONLY — no changes made' : 'Slots successfully added'}
` +
      `Database: ${describeDb(config)}
` +
      `Period: ${options.from} to ${options.to} (${result.days} days)
` +
      `New slots: ${result.added}
` +
      `Already occupied/overlapping times skipped: ${result.skipped}
` +
      `New slots by meal: ${Object.entries(result.byMeal).map(([meal, count]) => `${meal}=${count}`).join(', ')}
` +
      `Tables assigned per new slot: ${result.tables} (seats per table defined by MH-02)`);
  } finally {
    await db.close();
  }
}

try {
  await run();
} catch (error) {
  console.error(`Slot population failed: ${error.message}`);
  process.exitCode = 1;
}
