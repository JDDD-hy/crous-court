import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const origin = process.argv[2] || 'http://127.0.0.1:8795';
assert.equal(new URL(origin).hostname, '127.0.0.1', 'Synthetic uploads must stay local');
const email = `translation-${Date.now()}@example.invalid`;
const post = (path, data) => fetch(origin + path, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(data) });
const challenge = await (await post('/api/auth/email/request', { email })).json();
assert.ok(challenge.data?.devCode);
const verified = await post('/api/auth/email/verify', { email, challengeId: challenge.data.challengeId, code: challenge.data.devCode });
assert.equal(verified.status, 200);
const cookie = verified.headers.get('set-cookie').split(';')[0];
const image = await readFile('public/meals/couscous.jpg');
const form = new FormData();
for (const [key, value] of Object.entries({ venueId: 'cafeteria-lexperimental-2', eatenOn: '2026-09-15', mainName: '草莓酸奶', mainTier: '3', sideOneName: 'Roast chicken', sideOneTier: '3', rightsConfirmed: 'true' })) form.set(key, value);
for (const key of ['canonical', 'thumbnail']) form.set(key, new Blob([image], { type: 'image/jpeg' }), 'meal.jpg');
const uploaded = await fetch(origin + '/api/uploads', { method: 'POST', headers: { origin, cookie }, body: form });
assert.equal(uploaded.status, 201, await uploaded.text());
let dishes;
for (let attempt = 0; attempt < 15; attempt++) {
  dishes = (await (await fetch(origin + '/api/rankings?venue=cafeteria-lexperimental-2')).json()).data;
  if (dishes.some(d => d.originalDescription === '草莓酸奶' && d.machineNameEn) && dishes.some(d => d.originalDescription === 'Roast chicken' && d.machineNameZh)) break;
  await new Promise(resolve => setTimeout(resolve, 1000));
}
const chinese = dishes.find(d => d.originalDescription === '草莓酸奶' && d.machineNameEn);
const english = dishes.find(d => d.originalDescription === 'Roast chicken' && d.machineNameZh);
assert.match(chinese?.machineNameEn || '', /strawberry/i);
assert.match(english?.machineNameZh || '', /鸡/);
for (const [dish, locale, translated] of [[chinese, 'en', chinese.machineNameEn], [english, 'zh', english.machineNameZh]]) {
  const html = await (await fetch(origin + '/dish/' + dish.id, { headers: { cookie: `crous-locale=${locale}` } })).text();
  assert.ok(html.includes(translated));
  assert.ok(!dish.canonicalNameEn && !dish.canonicalNameZh, 'Machine output cannot become a confirmed name');
}
console.log('Real DeepL upload, persistence and both localized detail pages passed.', { en: chinese.machineNameEn, zh: english.machineNameZh, dishId: chinese.id });
