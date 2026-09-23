// Requires an isolated local DB with all migrations, db/fixtures.sql, then
// db/fixtures-ranking-style.sql; serve its built Worker before running this check.
// Never writes to a remote site.
// node scripts/verify-ranking-style.mjs http://127.0.0.1:8795 <playwright entrypoint>
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const origin = process.argv[2] || "http://127.0.0.1:8795";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const { chromium } = await import(process.argv[3] ? pathToFileURL(process.argv[3]).href : "playwright");
const out = new URL("../.sites-runtime/ranking-style/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const checks = [];
try {
  for (const locale of ["zh", "en"]) {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    await context.addCookies([{ name: "crous-locale", value: locale, url: origin }]);
    await context.addInitScript(() => localStorage.setItem("crous-usage-guide-seen", "1"));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto(`${origin}/rankings?venue=all`, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    assert.equal(await page.locator("[data-dish-stack]").count(), 2);
    const toggles = page.locator("[data-dish-stack] > header button");
    assert.equal(await toggles.count(), 2);
    async function checkLayout(width, scale) {
      // Style changes, viewport changes and GSAP's resize work settle before measurement.
      await page.waitForTimeout(250);
      await page.evaluate(() => scrollTo(0, 0));
      const state = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        cards: [...document.querySelectorAll("[data-ranking-card]")].map(el => ({
          border: getComputedStyle(el).borderTopWidth,
          shadow: getComputedStyle(el).boxShadow,
          right: el.getBoundingClientRect().right,
          clipped: el.scrollWidth > el.clientWidth + 1,
        })),
        toggles: [...document.querySelectorAll("[data-dish-stack] > header button")].map(el => {
          const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, right: r.right };
        }),
      }));
      assert.equal(state.overflow, false, `${locale}/${width}/${scale}: page overflow`);
      assert.ok(state.cards.every(c => Number.parseFloat(c.border) >= 3 && c.shadow !== "none" && c.right <= width && !c.clipped), JSON.stringify(state));
      assert.ok(state.toggles.every(b => b.width >= 44 && b.height >= 44 && b.right <= width));
      checks.push({ locale, width, scale, cards: state.cards.length, overflow: false });
    }
    for (const width of [320, 360, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      await checkLayout(width, 1);
      if ([390, 1280].includes(width)) await page.screenshot({ path: new URL(`${locale}-${width}.png`, out).pathname.replace(/^\/(\w:)/, "$1"), fullPage: true });
    }
    await page.setViewportSize({ width: 320, height: 1000 });
    await toggles.nth(0).focus(); await page.keyboard.press("Enter");
    await page.locator("[data-dish-stack]").nth(0).locator("[data-ranking-card]").nth(1).waitFor();
    await toggles.nth(1).click();
    await page.locator("[data-dish-stack]").nth(1).locator("[data-ranking-card]").nth(1).waitFor();
    assert.equal(await page.locator('[data-stack-open="true"]').count(), 2);
    await checkLayout(320, 1);
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await checkLayout(320, 2);
    await page.screenshot({ path: new URL(`${locale}-320-expanded-200.png`, out).pathname.replace(/^\/(\w:)/, "$1"), fullPage: true });
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await toggles.nth(0).click();
    assert.equal(await toggles.nth(1).getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator("[data-ranking-card]").count(), 3);
    // A failed expansion keeps its own retry control without changing the other group.
    await page.route("**/api/rankings?**", route => route.fulfill({ status: 500, body: "{}" }));
    await toggles.nth(0).click();
    await page.locator('[data-dish-stack]').nth(0).getByRole("alert").waitFor();
    await checkLayout(320, 1);
    await page.unroute("**/api/rankings?**");
    await page.getByRole("button", { name: locale === "zh" ? "重试" : "Retry", exact: true }).click();
    await page.locator("[data-ranking-card]").nth(3).waitFor();
    await page.getByRole("link", { name: locale === "zh" ? "🥄 小菜" : "🥄 Sides", exact: true }).click();
    await page.waitForURL("**category=side");
    assert.equal(new URL(page.url()).searchParams.get("venue"), "all");
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(new URL("checks.json", out), JSON.stringify({ passed: true, checks }, null, 2));
  console.log(JSON.stringify({ passed: true, layoutChecks: checks.length, independentGroups: true, retry: true, keyboard: true, scopeNavigation: true }));
} finally { await browser.close(); }
