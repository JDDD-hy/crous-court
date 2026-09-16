// Local-only allowlisted admin rendering, no moderation writes or AI calls.
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
const origin = process.argv[2] || "http://127.0.0.1:8794";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("Local preview only");
const { chromium } = await import(process.argv[3] ? pathToFileURL(process.argv[3]).href : "playwright");
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await context.addCookies([{ name: "crous-locale", value: "en", url: origin }]);
  const request = await context.request.post(`${origin}/api/auth/email/request`, { headers: { origin }, data: { email: "review-admin@example.invalid" } });
  assert.equal(request.status(), 200);
  const { data } = await request.json();
  assert.match(data.devCode, /^\d{6}$/, "Local test mode required");
  const verified = await context.request.post(`${origin}/api/auth/email/verify`, { headers: { origin }, data: { email: "review-admin@example.invalid", challengeId: data.challengeId, code: data.devCode } });
  assert.equal(verified.status(), 200);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const response = await page.goto(`${origin}/admin`, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  for (const tab of ["Reports", "Name suggestions", "AI merge suggestions", "Manage records"]) {
    await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
    const text = await page.locator("main").innerText();
    assert.doesNotMatch(text.replaceAll("中文", ""), /\p{Script=Han}/u, tab);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${tab}: desktop overflow`);
  }
  await page.screenshot({ path: fileURLToPath(new URL("../.sites-runtime/review-20260915/admin-en-desktop.png", import.meta.url)), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Admin mobile overflow");
  assert.deepEqual(errors, []);
  console.log("PASS: English allowlisted admin tabs, generated labels, desktop/mobile layout; no moderation writes or AI requests.");
} finally { await browser.close(); }
