// Local HTTP regressions against scripts/night-quality-server.mjs only.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const state = JSON.parse(readFileSync('.sites-runtime/night-quality/server.json', 'utf8'));
const { origin, cookies, sqlitePath, persist } = state;
assert.equal(origin, 'http://127.0.0.1:8820');
const results = [];
const baseImage = readFileSync('public/meals/couscous.jpg');
function image(i) { return Buffer.concat([baseImage.subarray(0, 2), Buffer.from([255, 238, 0, 4, i, 0]), baseImage.subarray(2)]); }
async function check(name, fn) {
  try { results.push({ name, passed: true, evidence: await fn() }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); }
  writeFileSync(`${persist}/http-results.json`, JSON.stringify({ baseline: state.baseline, results }, null, 2));
}
function rows(sql) { const db = new DatabaseSync(sqlitePath, { readOnly: true }); try { return db.prepare(sql).all(); } finally { db.close(); } }
async function control(mode, delay = 200) { await fetch('http://127.0.0.1:8821/control', { method: 'POST', body: JSON.stringify({ mode, delay }) }); }
async function identify(user, bytes = image(0)) {
  const form = new FormData(); form.set('image', new Blob([bytes], { type: 'image/jpeg' }), 'synthetic.jpg');
  const response = await fetch(`${origin}/api/ai/identify`, { method: 'POST', headers: { origin, cookie: cookies[user] + '; crous-locale=en' }, body: form, signal: AbortSignal.timeout(10000) });
  return { status: response.status, body: await response.json() };
}
async function upload(user, bytes = image(1)) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ venueId: 'cafeteria-escoffier-2', eatenOn: '2026-09-01', mainName: 'Synthetic HTTP tray', mainTier: '3', rightsConfirmed: 'true' })) form.set(key, value);
  form.set('canonical', new Blob([bytes], { type: 'image/jpeg' }), 'synthetic.jpg');
  form.set('thumbnail', new Blob([bytes], { type: 'image/jpeg' }), 'synthetic.jpg');
  const response = await fetch(`${origin}/api/uploads`, { method: 'POST', headers: { origin, cookie: cookies[user] + '; crous-locale=en' }, body: form, signal: AbortSignal.timeout(10000) });
  return { status: response.status, body: await response.json() };
}
await check('concurrent-identical-ai', async () => {
  await control('valid', 400);
  const responses = await Promise.all([identify('one'), identify('one')]);
  writeFileSync(`${persist}/ai-duplicate-receipts.json`, JSON.stringify(responses, null, 2));
  assert.deepEqual(responses.map(row => row.status), [200, 200]);
  assert.deepEqual(responses[0].body.data, responses[1].body.data);
  assert.equal(rows("SELECT COUNT(*) n FROM ai_identifications WHERE user_id='night-one'")[0].n, 1);
  const before = (await (await fetch('http://127.0.0.1:8821/stats')).json()).calls;
  assert.equal((await identify('one')).status, 200);
  assert.equal((await (await fetch('http://127.0.0.1:8821/stats')).json()).calls, before);
  return { statuses: responses.map(row => row.status), stored: 1, warmExtraModelCalls: 0 };
});
await check('provider-rate-limit', async () => {
  await control('limited'); const response = await identify('two');
  writeFileSync(`${persist}/provider-limit-receipt.json`, JSON.stringify(response, null, 2));
  assert.equal(response.status, 429); assert.match(response.body.error, /Too many AI requests/);
  return { status: response.status, localized: true };
});
await check('invalid-ai-schema-bounded-retry', async () => {
  await control('invalid');
  const before = (await (await fetch('http://127.0.0.1:8821/stats')).json()).calls;
  const response = await identify('three'); assert.equal(response.status, 502);
  assert.equal((await (await fetch('http://127.0.0.1:8821/stats')).json()).calls - before, 2);
  assert.equal(rows("SELECT COUNT(*) n FROM ai_identifications WHERE user_id='night-three'")[0].n, 0);
  return { status: response.status, calls: 2, stored: 0 };
});
await check('ai-daily-limit-and-independent-accounts', async () => {
  await control('valid');
  const responses = await Promise.all([10, 11, 12, 13].map(i => identify('four', image(i))));
  assert.deepEqual(responses.map(row => row.status).sort(), [200, 200, 200, 429]);
  assert.equal(rows("SELECT attempts FROM ai_rate_limits WHERE user_id='night-four'")[0].attempts, 3);
  assert.equal((await identify('admin', image(10))).status, 200);
  return { statuses: responses.map(row => row.status), attempts: 3, otherAccount: 200 };
});
await check('concurrent-identical-upload', async () => {
  const responses = await Promise.all([upload('one'), upload('one')]);
  writeFileSync(`${persist}/upload-duplicate-receipts.json`, JSON.stringify(responses, null, 2));
  assert.deepEqual(responses.map(row => row.status).sort(), [201, 400]);
  assert.match(responses.find(row => row.status === 400).body.error, /already submitted this tray/);
  assert.equal(rows("SELECT COUNT(*) n FROM photos WHERE creator_id='night-one'")[0].n, 1);
  const other = await upload('two'); assert.equal(other.status, 201);
  assert.deepEqual(rows('PRAGMA foreign_key_check'), []);
  return { statuses: responses.map(row => row.status), ownPhotos: 1, otherAccount: 201, foreignKeyErrors: 0 };
});
await check('sixty-concurrent-votes-atomic-limit', async () => {
  const responses = await Promise.all(Array.from({ length: 60 }, async (_, i) => {
    const response = await fetch(`${origin}/api/dishes/night-d${i}/vote`, { method: 'POST', headers: { origin, cookie: cookies.four, 'content-type': 'application/json' }, body: JSON.stringify({ targetTier: 3 }), signal: AbortSignal.timeout(10000) });
    return { dish: `night-d${i}`, status: response.status, body: await response.json() };
  }));
  writeFileSync(`${persist}/vote-limit-receipts.json`, JSON.stringify(responses, null, 2));
  assert.equal(responses.filter(row => row.status === 200).length, 30);
  assert.equal(responses.filter(row => row.status === 429).length, 30);
  assert.deepEqual(rows("SELECT dish_id FROM votes WHERE user_id='night-four' ORDER BY dish_id").map(row => row.dish_id), responses.filter(row => row.status === 200).map(row => row.dish).sort());
  assert.equal(rows("SELECT attempts FROM vote_rate_limits WHERE user_id='night-four'")[0].attempts, 30);
  assert.deepEqual(rows('PRAGMA foreign_key_check'), []);
  return { accepted: 30, limited: 30, persisted: 30, foreignKeyErrors: 0 };
});
console.log(JSON.stringify({ persist, results }, null, 2));
if (results.some(row => !row.passed)) process.exitCode = 1;
