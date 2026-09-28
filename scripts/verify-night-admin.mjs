// Real local browser controls: location filtering, naming review, reports, merge and split.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const state = JSON.parse(readFileSync('.sites-runtime/night-quality/server.json', 'utf8'));
const { origin } = state;
assert.equal(origin, 'http://127.0.0.1:8820');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await context.addInitScript(() => localStorage.setItem('crous-usage-guide-seen', '1'));
const page = await context.newPage(); page.setDefaultTimeout(12000);
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => dialog.accept());
async function account(user) { await context.clearCookies(); await context.addCookies([{ name: 'crous_session', value: state.cookies[user].split('=')[1], url: origin }]); }
async function goto(route) { await page.goto(origin + route, { waitUntil: 'networkidle' }); }
async function action(click) { const result = page.waitForResponse(response => response.url().endsWith('/api/admin/actions')); await click(); const response = await result; const body = await response.json(); assert.equal(response.status(), 200, JSON.stringify(body)); await page.waitForLoadState('networkidle'); return body.data; }
try {
  await account('four'); await goto('/venues');
  await page.getByRole('searchbox', { name: '餐厅名称或城市' }).fill('Paris');
  assert.equal(await page.locator('[data-venue-id]').count(), 12);
  const first = await page.locator('[data-venue-id]').first().getAttribute('data-venue-id');
  await page.getByRole('button', { name: '再看 12 家', exact: true }).click();
  assert.notEqual(await page.locator('[data-venue-id]').first().getAttribute('data-venue-id'), first);
  await page.getByRole('searchbox', { name: '餐厅名称或城市' }).fill('Escoffier');
  await page.locator('[data-venue-id="ru-escoffier-2"] button').click();
  assert.ok((await context.cookies()).some(cookie => cookie.name === 'crous-venues' && decodeURIComponent(cookie.value) === 'ru-escoffier-2'));
  checks.push('venue search, 12-item pagination and explicit selection persist');
  await goto('/rankings');
  assert.ok(await page.locator('[data-ranking-card]').count());
  assert.ok((await page.locator('[data-ranking-card]').first().getAttribute('href')).includes('venue=ru-escoffier-2'));
  checks.push('saved venue restores ranking navigation');
  // Local geolocation permission only; the live site is never visited.
  const venue = (await (await fetch(origin + '/api/venues')).json()).data.find(venue => venue.id === 'ru-lexperimental-2');
  await context.grantPermissions(['geolocation'], { origin });
  await context.setGeolocation(venue.points.find(Boolean));
  await goto('/venues');
  await page.getByRole('button', { name: '附近 1 km', exact: true }).click();
  await page.locator('[data-venue-id="ru-lexperimental-2"]').waitFor();
  const distances = await page.locator('[data-venue-id] button').allTextContents();
  assert.ok(distances.every(text => Number(text.match(/(\d+) m ·/)?.[1]) <= 1000));
  checks.push('nearby geolocation returns only <=1 km results');
  await goto('/dish/night-d3');
  await page.getByRole('button', { name: '举报这份档案', exact: true }).click();
  await page.getByPlaceholder('补充说明（可选）').fill('Synthetic review request');
  await page.getByRole('button', { name: '提交举报', exact: true }).click();
  await page.getByText('书记员已收件，等待复核。', { exact: true }).waitFor();
  checks.push('report submits through browser');
  for (const user of ['one', 'two', 'four']) {
    await account(user); await goto('/dish/night-d2');
    await page.getByRole('tab', { name: '群众认菜', exact: true }).click();
    await page.getByRole('button', { name: '我也这么认', exact: true }).click();
    await page.getByText('支持已记录', { exact: true }).waitFor();
  }
  await page.getByText(/群众认领/).first().waitFor();
  checks.push('three other accounts endorse one proposal through browser');
  await account('admin'); await goto('/admin');
  await action(() => page.getByRole('button', { name: '处理完成', exact: true }).click());
  await page.getByText('当前没有待处理举报。', { exact: true }).waitFor();
  await page.getByRole('tab', { name: /^待认菜/ }).click();
  await action(() => page.getByRole('button', { name: '确认为中文名', exact: true }).click());
  checks.push('administrator resolves report and verifies name');
  await page.getByRole('tab', { name: '合并记录', exact: true }).click();
  await page.getByRole('textbox', { name: '查询菜名或 Dish ID', exact: true }).fill('night-d');
  await page.getByRole('button', { name: '查询', exact: true }).click();
  await page.getByRole('button', { name: '加载更多', exact: true }).waitFor();
  await page.getByRole('button', { name: '加载更多', exact: true }).click();
  await page.locator('article').nth(25).waitFor();
  assert.ok(await page.locator('article').count() > 25);
  await page.getByRole('textbox', { name: '来源 Dish ID', exact: true }).fill('night-d5');
  await page.getByRole('textbox', { name: '目标 Dish ID', exact: true }).fill('night-d4');
  await action(() => page.getByRole('button', { name: '合并', exact: true }).click());
  const detail = await (await fetch(origin + '/api/dishes/night-d4')).json(); assert.equal(detail.data.servingCount, 2);
  await page.getByRole('textbox', { name: '待拆分的 Serving ID', exact: true }).fill('night-d5');
  await page.getByRole('textbox', { name: '拆分后的菜名', exact: true }).fill('合成拆分 Synthetic split');
  const split = await action(() => page.getByRole('button', { name: '拆分', exact: true }).click());
  assert.equal((await (await fetch(origin + '/api/dishes/' + split.dishId)).json()).data.votes, 1);
  checks.push('admin query pagination, explicit merge and split retain sightings/initial vote');
  await page.screenshot({ path: `${state.persist}/browser/admin-390.png`, fullPage: true });
  assert.deepEqual(errors, []);
} catch (error) {
  await page.screenshot({ path: `${state.persist}/browser/admin-failure.png`, fullPage: true });
  errors.push(error.message); process.exitCode = 1;
} finally {
  writeFileSync(`${state.persist}/browser/admin-results.json`, JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2)); await browser.close();
}
