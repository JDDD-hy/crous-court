import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

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
const result = await uploaded.json();
assert.equal(uploaded.status, 201, JSON.stringify(result));
let dishes;
for (let attempt = 0; attempt < 15; attempt++) {
  dishes = (await (await fetch(origin + '/api/rankings?venue=cafeteria-lexperimental-2')).json()).data.filter(d => d.image === '/api/photos/' + result.data.photoId);
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

if (process.argv[3]) {
  const { chromium } = await import(pathToFileURL(process.argv[3]).href);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext();
    const separator = cookie.indexOf('=');
    await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: origin }, { name: 'crous-locale', value: 'en', url: origin }]);
    const page = await context.newPage();
    await page.route('**/api/ai/identify', route => route.fulfill({ json: { data: { analysis_status: 'identified', is_food_image: true, staple: { name: 'Strawberry', confidence: 0.9, region: null }, side_dishes: [], warnings: [], scene_description: '' } } }));
    await page.route('**/api/dishes/candidates?**', route => route.fulfill({ json: { data: [{ id: chinese.id, name: 'Long English translation '.repeat(8) + '(machine translated)', image: null, venue: null, date: null }] } }));
    await page.goto(origin + '/upload?venue=cafeteria-lexperimental-2');
    await page.locator('input[type=file]').setInputFiles('public/meals/lentilles-saucisse.jpg');
    await page.getByRole('button', { name: 'Identify food', exact: true }).click();
    await page.getByRole('button', { name: 'Use these suggestions', exact: true }).click();
    await page.locator('input[name=mainName]').fill('Strawberry');
    await page.getByRole('button', { name: 'This is it', exact: true }).first().click();
    assert.equal(await page.locator('input[name=mainName]').inputValue(), 'Strawberry');
    assert.equal(await page.locator('input[name=mainDishId]').inputValue(), chinese.id);
    await page.locator('input[name=mainName]').fill('Different dish');
    assert.equal(await page.locator('input[name=mainDishId]').inputValue(), '');
    console.log('Long translated candidate preserves bounded input and identity; editing clears identity.');
  } finally { await browser.close(); }
}
