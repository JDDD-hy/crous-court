// Read-only checks against local review data; device coordinates are simulated.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const origin = process.argv[2] || "http://127.0.0.1:8794";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("Local preview only");
const { chromium } = await import(pathToFileURL(process.argv[3]).href);
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const get = async path => { const response = await context.request.get(origin + path); assert.equal(response.status(), 200); return (await response.json()).data; };
  const global = await get("/api/rankings");
  for (const [id, name] of [["venue-escoffier", "Escoffier"], ["venue-experimental", "Expérimental"]]) {
    const filtered = await get(`/api/rankings?venue=${id}`);
    assert.ok(filtered.length, "Seeded venue has sightings");
    for (const dish of filtered) {
      assert.ok(dish.venue.includes(name));
      const unfiltered = global.find(item => item.id === dish.id);
      assert.deepEqual(dish.distribution, unfiltered.distribution, "Votes remain global");
      const detail = await get(`/api/dishes/${dish.id}`);
      const dates = detail.servings.filter(item => item.venue.includes(name)).map(item => item.date).sort();
      assert.equal(dish.date, dates.at(-1), "Latest sighting belongs to chosen venue");
    }
  }
  assert.equal((await context.request.get(origin + "/api/rankings?venue=unknown-place")).status(), 400);
  assert.deepEqual(await get("/api/rankings?venue=none"), []);
  const page = await context.newPage();
  const errors = []; page.on("pageerror", error => errors.push(error.message));

  await page.goto(origin + "/rankings?venue=none", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "选择案发地点", exact: true }).click();
  await page.getByRole("button", { name: "+ 自己输入", exact: true }).click();
  await page.getByLabel("餐厅名称或城市").fill("Coulée");
  await page.getByRole("button", { name: /Brasserie La Coulée Verte/ }).click();
  await page.waitForURL("**/rankings?venue=brasserie-la-coulee-verte-2");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator("header details").getAttribute("open"), null);
  await page.getByRole("link", { name: "今日开庭", exact: true }).click();
  await page.waitForURL("**/?venue=brasserie-la-coulee-verte-2");
  await page.waitForLoadState("networkidle");
  assert.ok((await page.locator("header summary").innerText()).includes("Coulée"));
  await page.evaluate(() => { navigator.geolocation.getCurrentPosition = ok => ok({ coords: { latitude: 48.7128, longitude: 2.2051, accuracy: 20 } }); });
  await page.locator("header summary").click();
  await page.getByRole("button", { name: "附近 1 km", exact: true }).click();
  await page.getByRole("button", { name: "使用以上附近餐厅", exact: true }).click();
  await page.waitForURL(url => url.searchParams.getAll("venue").length === 4);
  await page.waitForLoadState("networkidle");
  await page.locator("header").getByRole("link", { name: "长期榜单", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await context.addCookies([{ name: "crous-locale", value: "en", url: origin }]);
  await page.reload({ waitUntil: "networkidle" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.evaluate(() => { navigator.geolocation.getCurrentPosition = (_ok, fail) => fail({ code: 3 }); });
  const before = page.url();
  await page.locator("header summary").click();
  await page.getByRole("button", { name: "Within 1 km", exact: true }).click();
  await page.getByRole("alert").waitFor(); assert.equal(page.url(), before);
  await page.goto(origin + "/story", { waitUntil: "networkidle" });
  assert.ok((await page.locator("main").innerText()).includes("so more students eating at CROUS in France could join in."));
  assert.deepEqual(errors, []);
  console.log("PASS: scoped sightings/global votes, official venue search, nearby ordering scope, navigation/reload, invalid/empty scope, failed location, English mobile and Story.");
} finally { await browser.close(); }
