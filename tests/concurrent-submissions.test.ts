import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { identificationSchema } from "../lib/ai/dish-identification-schema.ts";
import { isCafeteria } from "../lib/venue-preference.ts";

function fixture(afterRead?: (sql: string) => Promise<void>) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
  sqlite.exec("INSERT INTO users(id) VALUES('one'),('two')");
  function prepare(sql: string) {
    let args: SQLInputValue[] = [];
    return {
      bind(...values: SQLInputValue[]) { args = values; return this; },
      async first() { const row = sqlite.prepare(sql).get(...args) ?? null; await afterRead?.(sql); return row; },
      run() { return { meta: { changes: sqlite.prepare(sql).run(...args).changes } }; },
    };
  }
  const db = { prepare, async batch(statements: ReturnType<typeof prepare>[]) {
    sqlite.exec("BEGIN");
    try { const results = statements.map(statement => statement.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } };
  return { sqlite, db };
}

function source(file: string) {
  return stripTypeScriptTypes(readFileSync(file, "utf8").replace(/^import .*;\r?\n/gm, ""), { mode: "transform" }).replaceAll("export ", "");
}

test("simultaneous identical uploads return the duplicate error, roll back the loser and isolate accounts", async () => {
  let duplicateReads = 0;
  let release!: () => void;
  const bothRead = new Promise<void>(resolve => { release = resolve; });
  const { sqlite, db } = fixture(async sql => {
    if (sql.startsWith("SELECT meal_id")) { if (++duplicateReads === 2) release(); await bothRead; }
  });
  const objects = new Set<string>();
  const bucket = { async put(key: string) { objects.add(key); }, async delete(key: string) { objects.delete(key); } };
  const image = async () => ({ width: 1, height: 1, bytes: new ArrayBuffer(1), mediaType: "image/jpeg" });
  const publish = new Function("getBindings", "todayInTimezone", "checkSanitizedImage", "catalogById", "catalogVenueInsert", "isCafeteria",
    source("lib/upload/upload-service.ts") + "\nreturn publishMeal;")(
    () => ({ db, bucket }), () => "2026-09-28", image, new Map([["venue-escoffier", { timezone: "Europe/Paris" }]]),
    () => db.prepare("SELECT 1"), isCafeteria,
  ) as (form: FormData, user: string) => Promise<unknown>;
  const form = new FormData();
  for (const [key, value] of Object.entries({ venueId: "venue-escoffier", eatenOn: "2026-09-28", mainTier: "3", rightsConfirmed: "true" })) form.set(key, value);
  form.set("canonical", new File(["x"], "photo.jpg")); form.set("thumbnail", new File(["x"], "thumb.jpg"));
  try {
    const results = await Promise.allSettled([publish(form, "one"), publish(form, "one")]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    const rejected = results.find(result => result.status === "rejected");
    assert.equal(rejected?.status, "rejected");
    if (rejected?.status === "rejected") assert.equal(rejected.reason.message, "这张餐盘已经立过案了，请不要重复提交同一文件");
    assert.equal(objects.size, 2);
    for (const table of ["meals", "photos", "dishes", "servings", "votes"]) assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get()!.n, 1);
    await publish(form, "two");
    assert.equal(objects.size, 4);
    assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM meals").get()!.n, 2);
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { sqlite.close(); }
});

function aiFixture(status = 200) {
  const { sqlite, db } = fixture();
  let calls = 0;
  let locale = "zh";
  const result = { analysis_status: "identified", is_food_image: true, is_standard_meal: true, staple: { name: "Rice", confidence: 0.8, region: null }, side_dishes: [], other_visible_items: [], warnings: [], scene_description: "Rice" };
  const identify = new Function("env", "getRawDb", "getLocale", "checkSanitizedImage", "identificationSchema", "fetch",
    source("lib/ai/dish-identification.ts") + "\nreturn identifyDish;")(
    { AI_BASE_URL: "http://127.0.0.1/test-only", AI_API_KEY: "synthetic", AI_MODEL: "test" }, () => db, async () => locale,
    async (file: File) => ({ bytes: await file.arrayBuffer(), mediaType: "image/jpeg" }), identificationSchema,
    async () => { const call = ++calls; await new Promise(resolve => setTimeout(resolve, 10)); return Response.json({ choices: [{ message: { content: JSON.stringify({ ...result, scene_description: `Result ${call}` }) } }] }, { status }); },
  ) as (file: File, user: string) => Promise<unknown>;
  return { sqlite, identify, calls: () => calls, locale: (next: string) => { locale = next; } };
}

test("concurrent AI cache fills succeed without overwriting the winner and keep account/locale quotas separate", async () => {
  const f = aiFixture();
  const file = new File(["same image"], "photo.jpg");
  try {
    const results = await Promise.allSettled([f.identify(file, "one"), f.identify(file, "one")]);
    assert.ok(results.every(result => result.status === "fulfilled"), JSON.stringify(results));
    assert.deepEqual(results[0], results[1]);
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM ai_identifications").get()!.n, 1);
    await f.identify(file, "one"); assert.equal(f.calls(), 2, "a warm hit does not spend a model call");
    await f.identify(file, "two"); assert.equal(f.calls(), 3, "accounts do not share image caches");
    f.locale("en"); await f.identify(file, "one"); assert.equal(f.calls(), 4, "language-specific prompts have separate results");
    await assert.rejects(f.identify(new File(["different"], "photo.jpg"), "one"), (error: unknown) => error instanceof Error && "status" in error && error.status === 429);
    assert.equal(f.calls(), 4);
  } finally { f.sqlite.close(); }
});

test("AI provider rate limits retain HTTP 429 and are not retried as malformed output", async () => {
  const f = aiFixture(429);
  try {
    await assert.rejects(f.identify(new File(["image"], "photo.jpg"), "one"), (error: unknown) => error instanceof Error && "status" in error && error.status === 429);
    assert.equal(f.calls(), 1);
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM ai_identifications").get()!.n, 0);
  } finally { f.sqlite.close(); }
});
