// Disposable local-only D1/R2 and fake AI. No mail, provider credentials or remote writes.
// node scripts/night-quality-server.mjs [--baseline]
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = process.argv.includes('--baseline');
const persist = path.join(root, '.sites-runtime', `night-ui-${Date.now()}`);
const config = path.join(root, baseline ? '.sites-runtime/night-quality/baseline-dist/server/wrangler.json' : 'dist/server/wrangler.json');
const wrangler = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
const origin = 'http://127.0.0.1:8820';
const secret = 'night-quality-synthetic-secret-at-least-32-characters';
mkdirSync(persist, { recursive: true });
mkdirSync(path.join(root, '.sites-runtime/night-quality'), { recursive: true });
const migration = spawnSync(process.execPath, [wrangler, 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist, '--config', config], { cwd: root, encoding: 'utf8' });
assert.equal(migration.status, 0, migration.stdout + migration.stderr);
const directory = path.join(persist, 'v3/d1/miniflare-D1DatabaseObject');
const sqlitePath = path.join(directory, readdirSync(directory).find(name => name.endsWith('.sqlite') && name !== 'metadata.sqlite'));
const db = new DatabaseSync(sqlitePath);
db.exec('PRAGMA foreign_keys=ON');
db.exec(readFileSync(path.join(root, 'db/fixtures.sql'), 'utf8').replaceAll('venue-escoffier', 'ru-escoffier-2').replaceAll('venue-experimental', 'ru-lexperimental-2'));
const cookies = {};
const now = Math.floor(Date.now() / 1000);
for (const user of ['one', 'two', 'three', 'four', 'admin']) {
  const token = `night-local-synthetic-${user}`;
  cookies[user] = `crous_session=${token}`;
  db.prepare('INSERT INTO users(id,email_digest) VALUES(?,?)').run(`night-${user}`, createHmac('sha256', secret).update(`email\0${user}@example.invalid`).digest('base64url'));
  db.prepare('INSERT INTO auth_sessions(token_digest,user_id,expires_at,created_at) VALUES(?,?,?,?)').run(createHash('sha256').update(token).digest('base64url'), `night-${user}`, now + 28800, now);
}
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
db.exec('BEGIN');
for (let i = 0; i < 60; i++) {
  const id = `night-d${i}`;
  db.prepare("INSERT INTO dishes(id,venue_id,category,original_description) VALUES(?,'ru-escoffier-2','main',?)").run(id, `合成菜品 Synthetic dish ${i}`);
  db.prepare("INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) VALUES(?,'ru-escoffier-2','night-one',?,?,?)").run(id, date, id, 1000 + i);
  db.prepare("INSERT INTO servings(id,dish_id,venue_id,creator_id,served_on,initial_tier) VALUES(?,?,'ru-escoffier-2','night-one',?,3)").run(id, id, date);
  db.prepare("INSERT INTO meal_items(meal_id,serving_id,slot) VALUES(?,?,'main')").run(id, id);
}
for (let i = 0; i < 30; i++) {
  const id = `night-evidence${i}`;
  db.prepare("INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) VALUES(?,'ru-escoffier-2','night-one',?,?,?)").run(id, date, id, 2000 + i);
  db.prepare("INSERT INTO servings(id,dish_id,venue_id,creator_id,served_on,initial_tier,original_description) VALUES(?,'night-d0','ru-escoffier-2','night-one',?,3,?)").run(id, date, `Synthetic sighting ${i}`);
  db.prepare("INSERT INTO meal_items(meal_id,serving_id,slot) VALUES(?,?,'main')").run(id, id);
}
for (let i = 0; i < 101; i++) {
  db.prepare('INSERT INTO users(id) VALUES(?)').run(`night-voter${i}`);
  db.prepare("INSERT INTO votes(id,dish_id,user_id,target_tier,created_at) VALUES(?,'night-d0',?,?,?)").run(`night-v${i}`, `night-voter${i}`, i % 2 ? 3 : 2, `2026-09-01 00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`);
}
db.exec('COMMIT'); db.close();
let calls = 0, mode = 'valid', delay = 200;
const model = createServer(async (req, res) => {
  if (req.url === '/control') {
    const data = JSON.parse(await read(req)); mode = data.mode ?? mode; delay = data.delay ?? delay;
    res.end(JSON.stringify({ calls, mode, delay })); return;
  }
  if (req.url === '/stats') { res.end(JSON.stringify({ calls, mode, delay })); return; }
  await read(req); calls++;
  const responseMode = mode;
  await new Promise(resolve => setTimeout(resolve, delay));
  res.setHeader('content-type', 'application/json');
  if (responseMode === 'limited') { res.writeHead(429); res.end('{}'); return; }
  const result = { analysis_status: 'identified', is_food_image: true, is_standard_meal: true, staple: { name: 'Synthetic rice', confidence: 0.8, region: { x: 0.1, y: 0.1, width: 0.7, height: 0.7 } }, side_dishes: [], other_visible_items: [], warnings: [], scene_description: 'Synthetic local AI response' };
  res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(responseMode === 'invalid' ? {} : result) } }] }));
});
async function read(req) { let body = ''; for await (const chunk of req) body += chunk; return body; }
await new Promise(resolve => model.listen(8821, '127.0.0.1', resolve));
const envFile = path.join(persist, 'test-only.env');
writeFileSync(envFile, `AUTH_MODE=local\nAUTH_HMAC_SECRET=${secret}\nADMIN_EMAILS=admin@example.invalid\nAI_BASE_URL=http://127.0.0.1:8821/v1\nAI_API_KEY=synthetic-local-only\nAI_MODEL=night-test\n`);
const child = spawn(process.execPath, [wrangler, 'dev', '--local', '--config', config, '--persist-to', persist, '--ip', '127.0.0.1', '--port', '8820', '--inspector-port', '0', '--env-file', envFile], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
const log = chunk => { logs = (logs + chunk).slice(-20000); writeFileSync(path.join(persist, 'worker.log'), logs); };
child.stdout.on('data', log); child.stderr.on('data', log);
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error(logs)), 30000);
  const ready = chunk => { if (String(chunk).includes('Ready on')) { clearTimeout(timer); resolve(); } };
  child.stdout.on('data', ready); child.stderr.on('data', ready); child.once('error', reject);
});
const state = { origin, persist, sqlitePath, cookies, baseline };
writeFileSync(path.join(root, '.sites-runtime/night-quality/server.json'), JSON.stringify(state, null, 2));
console.log(JSON.stringify({ ready: true, origin, persist, baseline }));
async function stop() { child.kill(); model.closeAllConnections(); model.close(); process.exit(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
