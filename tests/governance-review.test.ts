import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { GovernanceError } from "../lib/governance/errors.ts";
import { translationCandidate, chineseTranslationCandidate } from "../lib/translation/deepl.ts";

function database() {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
  sqlite.exec(readFileSync("db/fixtures.sql", "utf8"));
  function prepare(sql: string) {
    let values: SQLInputValue[] = [];
    return {
      bind(...args: SQLInputValue[]) { values = args; return this; },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; },
    };
  }
  const db = { prepare, async batch(statements: ReturnType<typeof prepare>[]) {
    sqlite.exec("BEGIN");
    try { const result = statements.map(statement => statement.run()); sqlite.exec("COMMIT"); return result; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } };
  return { sqlite, db };
}

function source(file: string) {
  return stripTypeScriptTypes(readFileSync(file, "utf8").replace(/^import .*;\r?\n/gm, "")).replaceAll("export ", "");
}

test("bidirectional translations persist separately and stale results cannot overwrite edited sources", async () => {
  const { sqlite, db } = database();
  const translate = new Function("env", "getRawDb", "translateChineseNames", "translateEnglishNames", "chineseTranslationCandidate", "translationCandidate", source("lib/translation/translate-dishes.ts") + "\nreturn translateDishNames;")(
    { DEEPL_API_KEY: "test-only" }, () => db,
    async (names: string[]) => names.map(name => name === "草莓酸奶" ? "Strawberry yoghurt" : "Confirmed pudding"),
    async (names: string[]) => names.map(() => "烤鸡"), chineseTranslationCandidate, translationCandidate,
  ) as (dishes: Array<{ id: string }>) => Promise<void>;
  try {
    sqlite.exec("INSERT INTO dishes(id,original_description,category) VALUES('cn','草莓酸奶','side'),('en','Roast chicken','main');");
    await translate([{ id: "cn" }, { id: "en" }]);
    assert.equal(sqlite.prepare("SELECT machine_name_en FROM dishes WHERE id='cn'").get()!.machine_name_en, "Strawberry yoghurt");
    assert.equal(sqlite.prepare("SELECT machine_name_zh FROM dishes WHERE id='en'").get()!.machine_name_zh, "烤鸡");
    assert.equal(sqlite.prepare("SELECT canonical_name_en FROM dishes WHERE id='cn'").get()!.canonical_name_en, null);
    sqlite.exec("UPDATE dishes SET canonical_name_zh='确认布丁' WHERE id='cn'");
    await translate([{ id: "cn" }]);
    assert.equal(sqlite.prepare("SELECT machine_name_en_source FROM dishes WHERE id='cn'").get()!.machine_name_en_source, "确认布丁");
    const racing = new Function("env", "getRawDb", "translateChineseNames", "translateEnglishNames", "chineseTranslationCandidate", "translationCandidate", source("lib/translation/translate-dishes.ts") + "\nreturn translateDishNames;")(
      { DEEPL_API_KEY: "test-only" }, () => db,
      async () => { sqlite.exec("UPDATE dishes SET canonical_name_en='Manual winner',canonical_name_zh='新的中文名' WHERE id='cn'"); return ["Stale translation"]; },
      async () => [], chineseTranslationCandidate, translationCandidate,
    ) as typeof translate;
    await racing([{ id: "cn" }]);
    const row = sqlite.prepare("SELECT * FROM dishes WHERE id='cn'").get()!;
    assert.equal(row.canonical_name_en, "Manual winner");
    assert.equal(row.machine_name_en, "Confirmed pudding");
    assert.notEqual(row.machine_name_en_source, row.canonical_name_zh);
    assert.equal(row.original_description, "草莓酸奶");
  } finally { sqlite.close(); }
});

test("admin state changes roll back with audit failure and retries do not create phantom audits", async () => {
  const { sqlite, db } = database();
  const moderate = new Function("getRawDb", "GovernanceError", source("lib/governance/moderation-service.ts") + "\nreturn moderate;")(
    () => db, GovernanceError,
  ) as (admin: string, input: Record<string, unknown>) => Promise<unknown>;
  try {
    sqlite.exec("INSERT INTO reports(id,reporter_id,dish_id,reason) VALUES('report','fixture-user-01','mystery-dessert','wrong_dish'); INSERT INTO name_suggestions(id,dish_id,proposer_id,name,normalized_name,evidence_type) VALUES('name','mystery-dessert','fixture-user-01','Custard','custard','ate_today')");
    for (const [input, query, before, after] of [
      [{ action: "hide_meal", mealId: "fixture-meal-01" }, "SELECT status value FROM meals WHERE id='fixture-meal-01'", "active", "hidden"],
      [{ action: "resolve_report", reportId: "report" }, "SELECT status value FROM reports WHERE id='report'", "open", "resolved"],
      [{ action: "verify_name", suggestionId: "name", language: "en" }, "SELECT canonical_name_en value FROM dishes WHERE id='mystery-dessert'", null, "Custard"],
    ] as const) {
      const auditCount = sqlite.prepare("SELECT count(*) n FROM moderation_actions").get()!.n;
      sqlite.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON moderation_actions BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
      await assert.rejects(moderate("fixture-user-01", input), /audit unavailable/);
      assert.equal(sqlite.prepare(query).get()!.value, before);
      assert.equal(sqlite.prepare("SELECT count(*) n FROM moderation_actions").get()!.n, auditCount);
      sqlite.exec("DROP TRIGGER fail_audit");
      await moderate("fixture-user-01", input);
      assert.equal(sqlite.prepare(query).get()!.value, after);
      assert.equal(Number(sqlite.prepare("SELECT count(*) n FROM moderation_actions").get()!.n), Number(auditCount) + 1);
      if (input.action !== "verify_name") {
        await assert.rejects(moderate("fixture-user-01", input), (error: unknown) => error instanceof GovernanceError && error.status === 404);
        assert.equal(Number(sqlite.prepare("SELECT count(*) n FROM moderation_actions").get()!.n), Number(auditCount) + 1);
      }
    }
    await assert.rejects(moderate("fixture-user-01", { action: "toString" }), /管理操作无效/);
  } finally { sqlite.close(); }
});

test("dish suggestions return unique dishes and their latest visible observation", async () => {
  const { sqlite, db } = database();
  const find = new Function("getRawDb", "normalizeDishName", "getLocale", "getT", source("lib/governance/dish-candidates.ts") + "\nreturn findDishCandidates;")(
    () => db, (value: string) => value.toLowerCase(), async () => "en", async () => (value: string) => value,
  ) as (query: string, category: string) => Promise<Array<{ id: string; date: string; image: string }>>;
  try {
    sqlite.exec("UPDATE dishes SET original_description='Test dish'; UPDATE servings SET served_on='2026-09-01' WHERE id='fixture-serving-02'; INSERT INTO dish_aliases(id,dish_id,name,normalized_name,source) VALUES('alias-a','couscous-boulettes','Test alias','test alias','community'),('alias-b','couscous-boulettes','Test second','test second','community')");
    const rows = await find("test", "main");
    assert.deepEqual(rows.map(row => row.id), ["couscous-boulettes", "lentilles-saucisse"]);
    assert.equal(rows[0].date, "2026-09-10");
    sqlite.exec("UPDATE meals SET status='hidden' WHERE id='fixture-meal-01'");
    assert.equal((await find("test", "main"))[0].date, "2026-09-03");
    assert.equal((await find("test second", "main"))[0].id, "couscous-boulettes");
  } finally { sqlite.close(); }
});
