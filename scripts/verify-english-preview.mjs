// Runs only against a local Worker with AUTH_MODE=local and isolated test data.
// node scripts/verify-english-preview.mjs <origin> [absolute playwright entrypoint]
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
const origin = process.argv[2] || "http://127.0.0.1:8794";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("Local preview only");
const { chromium } = await import(process.argv[3] ? pathToFileURL(process.argv[3]).href : "playwright");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const outputs = new URL("../.sites-runtime/review-20260915/", import.meta.url);
await mkdir(outputs, { recursive: true });
const errors = [];
const nonce = Date.now();
const verifyTranslation = process.argv.includes("--translation");
const submittedName = verifyTranslation ? `Roast chicken with rice ${nonce}` : `English QA ${nonce}`;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await context.addCookies([{ name: "crous-locale", value: "en", url: origin }]);
  const page = await context.newPage();
  page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
  for (const route of ["/", "/rankings", "/story", "/upload", "/dish/couscous-boulettes", "/not-a-page"]) {
    const response = await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
    assert.equal(response.status(), route === "/not-a-page" ? 404 : 200, route);
    assert.equal(await page.locator("html").getAttribute("lang"), "en", route);
    assert.match(await page.title(), /CROUS Court/);
  }
  await page.goto(`${origin}/story`, { waitUntil: "networkidle" });
  await page.screenshot({ path: fileURLToPath(new URL("story-en-desktop.png", outputs)), fullPage: true });
  await page.getByRole("button", { name: "切换为中文", exact: true }).click();
  await page.waitForFunction(() => document.documentElement.lang === "zh-CN");
  await page.getByRole("button", { name: "Switch to English", exact: true }).click();
  await page.waitForFunction(() => document.documentElement.lang === "en");
  await page.goto(`${origin}/upload`, { waitUntil: "networkidle" });
  await page.getByLabel("Email address", { exact: true }).fill(`english-qa-${nonce}@example.invalid`);
  const codeResponse = page.waitForResponse((r) => r.url().endsWith("/api/auth/email/request") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  const codePayload = await (await codeResponse).json();
  assert.match(codePayload.data.devCode, /^\d{6}$/, "Local-only test mode required");
  await page.getByLabel("Six-digit email verification code", { exact: true }).fill(codePayload.data.devCode);
  await page.getByRole("button", { name: "Verify and continue", exact: true }).click();
  await page.getByRole("heading", { name: "Upload your tray", exact: true }).waitFor();

  const png = await page.evaluate((id) => { const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 400; const ctx = canvas.getContext("2d"); ctx.fillStyle = "#dbab63"; ctx.fillRect(0, 0, 640, 400); ctx.fillStyle = "#263629"; ctx.font = "24px sans-serif"; ctx.fillText(`Synthetic local QA ${id}`, 25, 180); return canvas.toDataURL("image/png").split(",")[1]; }, nonce);
  await page.locator('input[type="file"]').setInputFiles({ name: "synthetic-local-qa.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await page.locator('img[src^="blob:"]').first().waitFor();
  await page.locator('[name="mainName"]').fill(submittedName);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "切换为中文", exact: true }).click();
  assert.equal(await page.locator('[name="mainName"]').inputValue(), submittedName, "Cancelled switch preserves draft");
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  await page.locator('[name="sideOneName"]').fill("User original 原文");
  await page.locator('[name="sideOneTier"]').selectOption("2");
  await page.getByRole("checkbox").check();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "English upload mobile overflow");
  await page.screenshot({ path: fileURLToPath(new URL("upload-en-mobile.png", outputs)), fullPage: true });
  const uploadResponse = page.waitForResponse((r) => r.url().endsWith("/api/uploads") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Publish tray", exact: true }).click();
  const upload = await uploadResponse;
  assert.equal(upload.status(), 201, JSON.stringify(await upload.json()));
  await page.getByRole("heading", { name: "Evidence filed", exact: true }).waitFor();
  const rankings = await (await context.request.get(`${origin}/api/rankings`)).json();
  const dish = rankings.data.find((item) => item.zh === submittedName);
  assert.ok(dish);
  assert.ok(rankings.data.some((item) => item.zh === "User original 原文"), "User text preserved");
  if (verifyTranslation) {
    let translated;
    for (let attempt = 0; attempt < 12; attempt++) {
      translated = (await (await context.request.get(`${origin}/api/dishes/${dish.id}`)).json()).data;
      if (translated.machineNameZh) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert.match(translated.machineNameZh ?? "", /\p{Script=Han}/u, "Background English-to-Chinese translation persisted");
    assert.equal(translated.originalDescription, submittedName);
    assert.equal(translated.canonicalNameZh, null, "Machine translation is not a confirmed name");
    await context.addCookies([{ name: "crous-locale", value: "zh", url: origin }]);
    await page.goto(`${origin}/dish/${dish.id}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: `${translated.machineNameZh}（机译）`, exact: true }).waitFor();
    assert.ok((await page.locator("main").innerText()).includes(`原文：${submittedName}`));
    const candidates = await (await context.request.get(`${origin}/api/dishes/candidates?category=main&q=${encodeURIComponent(translated.machineNameZh)}`)).json();
    assert.ok(candidates.data.some(item => item.id === dish.id), "Translated Chinese name finds the original dish");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Machine translation mobile layout");
    await page.screenshot({ path: fileURLToPath(new URL("deepl-zh-mobile.png", outputs)), fullPage: true });
    await context.addCookies([{ name: "crous-locale", value: "en", url: origin }]);
    await page.goto(`${origin}/dish/${dish.id}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: submittedName, exact: true }).waitFor();
    console.log(`PASS: real DeepL English-to-Chinese translation, original/confirmed-name preservation, marked Chinese display, English original and Chinese search. Review dish: /dish/${dish.id}`);
  }
  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: fileURLToPath(new URL("home-en-mobile.png", outputs)), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "English home mobile overflow");
  await page.goto(`${origin}/dish/${dish.id}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Report this record", exact: true }).click();
  await page.getByRole("heading", { name: "Request a review", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Name this dish", exact: true }).click();
  await page.getByLabel("Suggested dish name", { exact: true }).fill("Plat de test");
  await page.getByRole("button", { name: "Suggest name", exact: true }).click();
  await page.getByText("Suggestion recorded", { exact: true }).waitFor();

  // Different user exercises a real first vote and authoritative duplicate-vote response.
  const voter = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await voter.addCookies([{ name: "crous-locale", value: "en", url: origin }]);
  async function post(ctx, path, data) { return ctx.request.post(`${origin}${path}`, { data, headers: { origin } }); }
  const requested = await (await post(voter, "/api/auth/email/request", { email: `english-voter-${nonce}@example.invalid` })).json();
  const verified = await post(voter, "/api/auth/email/verify", { email: `english-voter-${nonce}@example.invalid`, challengeId: requested.data.challengeId, code: requested.data.devCode });
  assert.equal(verified.status(), 200);
  const votePage = await voter.newPage();
  votePage.on("pageerror", (error) => errors.push(error.message));
  await votePage.goto(`${origin}/dish/${dish.id}`, { waitUntil: "networkidle" });
  await votePage.getByRole("button", { name: "I agree", exact: true }).click();
  await votePage.getByRole("button", { name: "Confirm verdict", exact: true }).click();
  await votePage.getByRole("button", { name: "Vote recorded", exact: true }).waitFor();
  const duplicate = await post(voter, `/api/dishes/${dish.id}/vote`, { targetTier: 5 });
  assert.equal(duplicate.status(), 409);
  const duplicatePayload = await duplicate.json();
  assert.equal(duplicatePayload.data.myVote, 3);
  assert.doesNotMatch(duplicatePayload.error, /\p{Script=Han}/u);
  assert.equal((await voter.request.get(`${origin}/api/admin/queue`)).status(), 403);
  await voter.close();
  assert.deepEqual(errors, []);
  console.log("PASS: English SSR/routes/metadata, language switch, local OTP session, draft protection, image upload/initial vote, original text, mobile layout, naming/report dialog, first/duplicate vote and admin denial.");
} finally { await browser.close(); }
