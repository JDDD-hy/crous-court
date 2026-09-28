// Requires scripts/night-quality-server.mjs. Playwright is supplied by the host, not a new app dependency.
// node scripts/verify-night-browser.mjs <playwright/index.mjs>
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const state = JSON.parse(readFileSync('.sites-runtime/night-quality/server.json', 'utf8'));
const { origin } = state;
assert.equal(origin, 'http://127.0.0.1:8820');
const out = `${state.persist}/browser`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [], errors = [], requests = [];
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await context.addInitScript(() => localStorage.setItem('crous-usage-guide-seen', '1'));
const page = await context.newPage();
page.setDefaultTimeout(12000);
page.on('pageerror', error => errors.push(error.message));
page.on('request', req => { if (new URL(req.url()).pathname.startsWith('/api/')) requests.push({ method: req.method(), path: new URL(req.url()).pathname }); });
async function check(name, fn) {
  try { await fn(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); await page.screenshot({ path: `${out}/${name}-failure.png`, fullPage: true }); }
  writeFileSync(`${out}/results.json`, JSON.stringify({ baseline: state.baseline, results, errors, requests }, null, 2));
}
async function account(name) {
  await context.clearCookies();
  const [cookieName, value] = state.cookies[name].split('=');
  await context.addCookies([{ name: cookieName, value, url: origin }]);
}
async function goto(route) { await page.goto(origin + route, { waitUntil: 'networkidle' }); }
try {
  await check('login-upload-reset', async () => {
    await goto('/upload?venue=ru-escoffier-2');
    await page.locator('#login-email').fill('browser@example.invalid');
    const requested = page.waitForResponse(response => response.url().endsWith('/api/auth/email/request'));
    await page.getByRole('button', { name: '发送验证码', exact: true }).click();
    const payload = await (await requested).json();
    await page.getByRole('textbox', { name: '六位邮箱验证码' }).fill(payload.data.devCode);
    await page.getByRole('button', { name: '验证并继续', exact: true }).click();
    await page.locator('input[type=file]').waitFor();
    const data = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#d5b26f'; ctx.fillRect(0, 0, 100, 100); return canvas.toDataURL('image/png').split(',')[1]; });
    writeFileSync(`${out}/synthetic.png`, Buffer.from(data, 'base64'));
    await page.locator('input[type=file]').setInputFiles(`${out}/synthetic.png`);
    await page.getByRole('button', { name: '开始识别', exact: true }).click();
    await page.getByRole('button', { name: '采用这些候选', exact: true }).click();
    assert.equal(await page.locator('input[name=mainName]').inputValue(), 'Synthetic rice');
    await page.locator('select[name=venueId]').selectOption('ru-escoffier-2');
    await page.getByRole('radio', { name: '夯', exact: true }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: '发布并立案', exact: true }).click();
    await page.getByRole('heading', { name: '证物已入库' }).waitFor();
    await page.getByRole('button', { name: '继续上传另一盘', exact: true }).click();
    const reset = { name: await page.locator('input[name=mainName]').inputValue(), rights: await page.getByRole('checkbox').isChecked(), tier: await page.getByRole('radio', { checked: true }).innerText() };
    writeFileSync(`${out}/upload-reset.json`, JSON.stringify(reset));
    await page.screenshot({ path: `${out}/upload-reset.png`, fullPage: true });
    assert.equal(reset.name, ''); assert.equal(reset.rights, false); assert.match(reset.tier, /人上人/);
  });
  await check('vote-and-account-isolation', async () => {
    await account('two'); await goto('/dish/night-d1?venue=ru-escoffier-2');
    await page.getByRole('button', { name: '判得对', exact: true }).click();
    await page.getByRole('button', { name: '确认落槌', exact: true }).click();
    await page.getByRole('button', { name: '已经落槌', exact: true }).waitFor();
    await account('three'); await goto('/dish/night-d1?venue=ru-escoffier-2');
    assert.equal(await page.getByRole('button', { name: '判得对', exact: true }).isEnabled(), true);
  });
  await check('naming-network-error', async () => {
    await page.getByRole('tab', { name: '群众认菜', exact: true }).click();
    await page.getByRole('textbox', { name: '菜品名称证词' }).fill('合成米饭');
    await page.route('**/api/dishes/night-d1/names', route => route.abort('failed'));
    await page.getByRole('button', { name: '提交证词', exact: true }).click();
    await page.getByRole('status').filter({ hasText: /失败|不可用/ }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: '菜品名称证词' }).inputValue(), '合成米饭');
  });
  await page.unroute('**/api/dishes/night-d1/names');
  await check('report-network-error', async () => {
    await goto('/dish/night-d3?venue=ru-escoffier-2');
    await page.getByRole('button', { name: '举报这份档案', exact: true }).click();
    await page.getByPlaceholder('补充说明（可选）').fill('Synthetic report');
    await page.route('**/api/reports', route => route.abort('failed'));
    await page.getByRole('button', { name: '提交举报', exact: true }).click();
    await page.getByRole('status').filter({ hasText: /失败|不可用/ }).waitFor();
    assert.equal(await page.getByPlaceholder('补充说明（可选）').inputValue(), 'Synthetic report');
  });
  await page.unroute('**/api/reports');
  await check('naming-submit', async () => {
    await goto('/dish/night-d2?venue=ru-escoffier-2');
    await page.getByRole('tab', { name: '群众认菜', exact: true }).click();
    await page.getByRole('textbox', { name: '菜品名称证词' }).fill('合成米饭');
    await page.getByRole('button', { name: '提交证词', exact: true }).click();
    await page.getByText('证词已记录', { exact: true }).waitFor();
    await page.getByRole('button', { name: '我也这么认', exact: true }).click();
    await page.getByText('提议者不能支持自己的名称', { exact: true }).waitFor();
  });
  await check('ranking-pagination', async () => {
    await goto('/rankings?venue=ru-escoffier-2');
    assert.equal(await page.locator('[data-ranking-card]').count(), 48);
    await page.getByRole('link', { name: '下一页', exact: true }).click();
    await page.waitForURL('**page=2');
    assert.equal(new URL(page.url()).searchParams.get('venue'), 'ru-escoffier-2');
    assert.ok(await page.locator('[data-ranking-card]').count() > 0);
  });
  await check('detail-pagination-scope', async () => {
    await goto('/dish/night-d0?venue=ru-escoffier-2&historyPage=2');
    const next = page.getByRole('navigation', { name: '结果分页' }).first().getByRole('link', { name: '下一页', exact: true });
    const href = await next.getAttribute('href');
    writeFileSync(`${out}/detail-pagination.json`, JSON.stringify({ href }));
    assert.equal(new URL(href, origin).searchParams.get('venue'), 'ru-escoffier-2');
    assert.equal(new URL(href, origin).searchParams.get('historyPage'), '2');
    await next.click(); await page.waitForURL('**evidencePage=2');
    await page.getByRole('tab', { name: '移动历史', exact: true }).click();
    const historyHref = await page.getByRole('navigation', { name: '结果分页' }).last().getByRole('link', { name: '上一页', exact: true }).getAttribute('href');
    assert.equal(new URL(historyHref, origin).searchParams.get('venue'), 'ru-escoffier-2');
    assert.equal(new URL(historyHref, origin).searchParams.get('evidencePage'), '2');
    await page.route('**/api/dishes/night-d0?*', route => route.abort('failed'));
    await page.getByRole('button', { name: '判得对', exact: true }).click();
    await page.getByRole('button', { name: '确认落槌', exact: true }).click();
    const refresh = page.getByRole('link', { name: '刷新查看最新判决历史', exact: true });
    await refresh.waitFor();
    const refreshHref = new URL(await refresh.getAttribute('href'), origin);
    assert.equal(refreshHref.searchParams.get('venue'), 'ru-escoffier-2');
    assert.equal(refreshHref.searchParams.get('evidencePage'), '2');
    await page.unroute('**/api/dishes/night-d0?*');
  });
  for (const locale of ['zh', 'en']) for (const width of [320, 390, 1280]) {
    await context.addCookies([{ name: 'crous-locale', value: locale, url: origin }]);
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/rankings?venue=all', '/dish/night-d0?venue=all', '/upload?venue=ru-escoffier-2', '/venues']) {
      const name = `${locale}-${width}-${route.split('?')[0].replaceAll('/', '_')}`;
      await check(name, async () => {
        await goto(route);
        await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
        const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
        assert.ok(sizes.document <= sizes.viewport, JSON.stringify(sizes));
      });
    }
  }
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify({ baseline: state.baseline, results, errors, requests }, null, 2));
  console.log(JSON.stringify({ out, passed: results.filter(row => row.passed).length, failed: results.filter(row => !row.passed), errors }, null, 2));
  await browser.close();
  if (results.some(row => !row.passed) || errors.length) process.exitCode = 1;
}
