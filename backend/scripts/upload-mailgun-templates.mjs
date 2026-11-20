/**
 * Upload/verify Mailgun templates without dashboard access (MH-03/06/07/08).
 *
 * Usage (from backend/):
 *   npm run mailgun:templates -- --status
 *   npm run mailgun:templates -- --only=created,updated,cancelled
 *   npm run mailgun:templates -- --test
 *
 * Flags:
 *   --status         list templates and active versions, no writes
 *   --dry-run        print what would be uploaded, no writes
 *   --only=a,b,c     created|updated|cancelled|reset (default: all)
 *   --force          upload a new active version even if one already exists
 *   --test           after the check, send a test-mode message (not delivered)
 *
 * Default behaviour is non-destructive: a template that already has an active
 * version is skipped. Credentials come from .env (API_KEY or MAILGUN_API_KEY,
 * MAILGUN_DOMAIN, optional MAILGUN_URL for the EU endpoint).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config/config.js';

const BASE = (config.mailgunUrl && String(config.mailgunUrl).trim()) || 'https://api.mailgun.net';
const DOMAIN = config.mailgunDomain;
const KEY = config.mailgunApiKey;
const TEMPLATES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../email-templates');

const TEMPLATES = [
  { kind: 'created', name: config.mailgunTemplate, file: 'booking-confirmation.html',
    sample: { name: 'Mario Rossi', date: '2026-12-01', start_time: '19:00', end_time: '20:00',
      meal: 'dinner', guests: 2, split: false, booking_id: 1042, party_requirements: [] } },
  { kind: 'updated', name: config.mailgunUpdatedTemplate, file: 'booking-modification.html',
    sample: { name: 'Mario Rossi', date: '2026-12-01', start_time: '19:00', end_time: '20:00',
      meal: 'dinner', guests: 4, split: false, booking_id: 1042, party_requirements: [] } },
  { kind: 'cancelled', name: config.mailgunCancelledTemplate, file: 'booking-cancelled.html',
    sample: { name: 'Mario Rossi', date: '2026-12-01', start_time: '19:00', end_time: '20:00',
      meal: 'dinner', guests: 2, split: false, booking_id: 1042, party_requirements: [] } },
  { kind: 'reset', name: config.mailgunResetTemplate, file: 'password-reset.html',
    sample: { name: 'Mario Rossi', reset_url: 'https://example.test/reset-password?token=demo',
      expires_in_hours: 24 } },
];

function parseArgs(argv) {
  const args = { only: null, status: false, dryRun: false, force: false, test: false, events: false, recipient: null };
  for (const arg of argv) {
    if (arg === '--status') args.status = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--test') args.test = true;
    else if (arg === '--events') args.events = true;
    else if (arg.startsWith('--recipient=')) args.recipient = arg.slice('--recipient='.length).trim();
    else if (arg.startsWith('--only=')) args.only = arg.slice('--only='.length).split(',').map((v) => v.trim());
    else if (arg === '--help' || arg === '-h') {
      console.log('Flags: --status --events --recipient=email --dry-run --only=created,updated,cancelled,reset --force --test');
      process.exit(0);
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }
  return args;
}

const auth = 'Basic ' + Buffer.from(`api:${KEY}`).toString('base64');

async function call(method, apiPath, form) {
  const response = await fetch(`${BASE}${apiPath}`, {
    method,
    headers: { Authorization: auth },
    body: form,
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}

async function templateInfo(name) {
  // GET /templates/{name} does not include versions; the versions endpoint is
  // the authoritative source for "exists" and "has an active version".
  const result = await call('GET', `/v3/${encodeURIComponent(DOMAIN)}/templates/${encodeURIComponent(name)}/versions`);
  if (result.status === 404) return { exists: false, versions: [] };
  if (result.status !== 200) throw new Error(`GET template ${name}: ${result.status} ${JSON.stringify(result.body)}`);
  return { exists: true, versions: result.body?.template?.versions ?? [] };
}

async function uploadVersion(item, tag) {
  const html = await fs.readFile(path.join(TEMPLATES_DIR, item.file), 'utf8');
  const form = new FormData();
  // The Mailgun templates API expects the HTML in the `template` form field.
  // Sending it as a multipart file part is rejected ("Missing mandatory parameter").
  form.append('template', html);
  form.append('tag', tag);
  form.append('active', 'yes');
  return call('POST', `/v3/${encodeURIComponent(DOMAIN)}/templates/${encodeURIComponent(item.name)}/versions`, form);
}

async function ensureTemplate(item, { dryRun, force }) {
  const info = await templateInfo(item.name);
  const active = info.versions.find((version) => version.active);

  if (active && !force) {
    console.log(`skip  ${item.kind.padEnd(9)} "${item.name}" — active version ${active.tag} already exists`);
    return;
  }

  const tag = `v${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;

  if (dryRun) {
    console.log(`plan  ${item.kind.padEnd(9)} "${item.name}" <- ${item.file} (tag ${tag}, active)`);
    return;
  }

  if (!info.exists) {
    const form = new FormData();
    form.append('name', item.name);
    form.append('description', `Edelweiss Hut ${item.kind} email`);
    const created = await call('POST', `/v3/${encodeURIComponent(DOMAIN)}/templates`, form);
    if (created.status !== 200 && !/already exists/i.test(JSON.stringify(created.body))) {
      throw new Error(`create template ${item.name}: ${created.status} ${JSON.stringify(created.body)}`);
    }
    console.log(`new   ${item.kind.padEnd(9)} "${item.name}"`);
  }

  const uploaded = await uploadVersion(item, tag);
  if (uploaded.status !== 200) {
    throw new Error(`upload ${item.name}: ${uploaded.status} ${JSON.stringify(uploaded.body)}`);
  }
  console.log(`done  ${item.kind.padEnd(9)} "${item.name}" — active version ${tag}`);
}

async function sendTest(item) {
  const form = new FormData();
  form.append('from', config.mailgunFrom || `postmaster@${DOMAIN}`);
  form.append('to', `postmaster@${DOMAIN}`);
  form.append('subject', `[test] ${item.kind}`);
  form.append('template', item.name);
  form.append('h:X-Mailgun-Variables', JSON.stringify(item.sample));
  // Test mode: Mailgun validates and renders the template but does not deliver.
  form.append('o:testmode', 'yes');
  const result = await call('POST', `/v3/${encodeURIComponent(DOMAIN)}/messages`, form);
  console.log(`test  ${item.kind.padEnd(9)} "${item.name}" — ${result.status} ${JSON.stringify(result.body).slice(0, 200)}`);
  return result.status === 200;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!KEY || !DOMAIN) {
    throw new Error('MAILGUN_API_KEY (or API_KEY) and MAILGUN_DOMAIN are required in .env');
  }

  if (args.events) {
    for (const event of ['failed', 'rejected', 'delivered']) {
      const query = new URLSearchParams({ event, limit: '20' });
      if (args.recipient) query.set('recipient', args.recipient);
      const result = await call('GET', `/v3/${encodeURIComponent(DOMAIN)}/events?${query}`);
      console.log(`\nEVENT ${event}:`, result.status);
      if (!Array.isArray(result.body?.items)) {
        console.log(JSON.stringify(result.body).slice(0, 400));
        continue;
      }
      for (const item of result.body.items) {
        const status = item['delivery-status'] ?? {};
        console.log(JSON.stringify({
          when: item.timestamp,
          recipient: item.recipient,
          reason: item.reason,
          code: status.code,
          message: status.message,
          description: status.description,
        }));
      }
    }
    return;
  }

  const selected = TEMPLATES.filter((item) => !args.only || args.only.includes(item.kind));
  if (!selected.length) throw new Error('No template selected');

  console.log(`Mailgun ${BASE} · domain ${DOMAIN}\n`);

  if (args.status) {
    for (const item of selected) {
      const info = await templateInfo(item.name);
      const versions = info.versions.map((v) => `${v.tag}${v.active ? ' (active)' : ''}`).join(', ');
      console.log(`${info.exists ? 'found  ' : 'MISSING'} ${item.kind.padEnd(9)} "${item.name}"${versions ? ` — ${versions}` : ''}`);
    }
    return;
  }

  for (const item of selected) {
    await ensureTemplate(item, args);
  }

  if (args.test) {
    console.log('\nTest-mode renders (no email delivered):');
    let failures = 0;
    for (const item of selected) {
      if (!(await sendTest(item))) failures += 1;
    }
    if (failures) throw new Error(`${failures} test-mode render(s) failed`);
  }
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  process.exit(1);
});

