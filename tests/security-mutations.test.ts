import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { GovernanceError } from "../lib/governance/errors.ts";
import { normalizeDishName, validDishName } from "../lib/governance/name-utils.ts";

function source(file: string) {
  return stripTypeScriptTypes(readFileSync(file, "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace(/^export \{.*\} from .*;\r?\n/gm, ""), { mode: "transform" }).replaceAll("export ", "");
}

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
  sqlite.exec(`INSERT INTO users(id) VALUES('u0'),('u1'),('u2'),('u3'),('u4'),('u5');
    INSERT INTO dishes(id,category,venue_id) VALUES('dish','main','venue-escoffier'),('target','main','venue-escoffier');
    INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) VALUES('meal','venue-escoffier','u0','2026-09-01','test-1',1);
    INSERT INTO servings(id,dish_id,venue_id,served_on,creator_id,initial_tier) VALUES('serving','dish','venue-escoffier','2026-09-01','u0',3);
    INSERT INTO meal_items(meal_id,serving_id,slot) VALUES('meal','serving','main');
    INSERT INTO name_suggestions(id,dish_id,proposer_id,name,normalized_name,evidence_type) VALUES('suggestion','dish','u0','Custard','custard','ate_today');`);
  let afterRead: ((sql: string) => void) | undefined;
  let beforeBatch: (() => void) | undefined;
  function prepare(sql: string) {
    let bindings: SQLInputValue[] = [];
    return {
      bind(...values: SQLInputValue[]) { bindings = values; return this; },
      async first() {
        const row = sqlite.prepare(sql).get(...bindings) ?? null;
        afterRead?.(sql);
        return row;
      },
      async all() { return { results: sqlite.prepare(sql).all(...bindings) }; },
      run() {
        const statement = sqlite.prepare(sql);
        const results = statement.columns().length ? statement.all(...bindings) : [];
        const changes = statement.columns().length
          ? Number(sqlite.prepare("SELECT changes() count").get()!.count)
          : Number(statement.run(...bindings).changes);
        return { results, meta: { changes } };
      },
    };
  }
  const db = { prepare, async batch(statements: ReturnType<typeof prepare>[]) {
    const hook = beforeBatch; beforeBatch = undefined; hook?.();
    sqlite.exec("BEGIN");
    try { const results = statements.map(statement => statement.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } };
  const limit = new Function("getRawDb", "GovernanceError", source("lib/governance/rate-limit.ts") + "\nreturn enforceGovernanceLimit;")(() => db, GovernanceError);
  const naming = new Function("getRawDb", "GovernanceError", "normalizeDishName", "validDishName", "enforceGovernanceLimit",
    source("lib/governance/naming-service.ts") + "\nreturn {suggestName,endorseName};")(() => db, GovernanceError, normalizeDishName, validDishName, limit) as {
      suggestName(dish: string, user: string, input: Record<string, unknown>): Promise<{ id: string }>;
      endorseName(dish: string, suggestion: string, user: string): Promise<{ supporters: number; status: string }>;
    };
  const vote = new Function("getRawDb", "getDishSummary", "getUserVote", source("lib/vote-service.ts") + "\nreturn submitVote;")(
    () => db,
    async (id: string) => sqlite.prepare(`SELECT d.id FROM dishes d WHERE d.id=? AND d.merged_into_dish_id IS NULL
      AND EXISTS(SELECT 1 FROM servings s JOIN meal_items mi ON mi.serving_id=s.id JOIN meals m ON m.id=mi.meal_id
        WHERE s.dish_id=d.id AND s.status='active' AND m.status='active')`).get(id) ?? null,
    async (dish: string, user: string) => sqlite.prepare("SELECT target_tier FROM votes WHERE dish_id=? AND user_id=?").get(dish, user)?.target_tier ?? null,
  ) as (dish: string, user: string, tier: number) => Promise<{ myVote: number }>;
  return { sqlite, naming, vote,
    beforeBatch(hook: () => void) { beforeBatch = hook; },
    afterRead(hook: (sql: string) => void) { afterRead = hook; },
    count(table: string) { return Number(sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get()!.n); },
  };
}

function status(expected: number) {
  return (error: unknown) => error instanceof Error && "status" in error && error.status === expected;
}
const input = { name: "Chocolate", evidenceType: "ate_today" };

test("votes recheck visibility at insertion and preserve concurrent duplicate receipts and limits", async () => {
  const f = fixture();
  try {
    f.afterRead(sql => { if (sql.startsWith("SELECT 1 FROM dishes")) f.sqlite.exec("UPDATE meals SET status='hidden'"); });
    await assert.rejects(f.vote("dish", "u1", 2), status(404));
    assert.equal(f.count("votes"), 0);
    f.afterRead(() => {}); f.sqlite.exec("UPDATE meals SET status='active'");
    const results = await Promise.allSettled([f.vote("dish", "u1", 2), f.vote("dish", "u1", 5)]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    const duplicate = results.find(result => result.status === "rejected");
    assert.equal(duplicate?.status, "rejected");
    if (duplicate?.status === "rejected") {
      assert.equal(duplicate.reason.status, 409);
      assert.equal(duplicate.reason.currentVote.myVote, 2);
    }
    assert.equal(f.count("votes"), 1);
    const attempts = Number(f.sqlite.prepare("SELECT attempts FROM vote_rate_limits WHERE user_id='u1'").get()!.attempts);
    const burst = await Promise.allSettled(Array.from({ length: 35 }, () => f.vote("dish", "u1", 4)));
    assert.equal(burst.filter(result => result.status === "rejected" && result.reason.status === 429).length, 35 - (30 - attempts));
    assert.equal(f.sqlite.prepare("SELECT attempts FROM vote_rate_limits WHERE user_id='u1'").get()!.attempts, 30);
  } finally { f.sqlite.close(); }
});

test("name proposals reject moderation interleaves without creating rows or changing status", async () => {
  for (const mutation of ["UPDATE meals SET status='hidden'", "UPDATE dishes SET merged_into_dish_id='target' WHERE id='dish'"]) {
    const f = fixture();
    try {
      f.beforeBatch(() => f.sqlite.exec(mutation));
      await assert.rejects(f.naming.suggestName("dish", "u1", input), status(404));
      assert.equal(f.count("name_suggestions"), 1);
      assert.equal(f.sqlite.prepare("SELECT naming_status FROM dishes WHERE id='dish'").get()!.naming_status, "unknown");
    } finally { f.sqlite.close(); }
  }
  const f = fixture();
  try {
    await f.naming.suggestName("dish", "u1", input);
    await assert.rejects(f.naming.suggestName("dish", "u1", input), status(409));
    assert.equal(f.count("name_suggestions"), 2);
  } finally { f.sqlite.close(); }
});

test("endorsement eligibility is checked in the batch, including existing endorsers", async () => {
  for (const mutation of ["UPDATE meals SET status='hidden'", "UPDATE dishes SET merged_into_dish_id='target' WHERE id='dish'",
    "UPDATE name_suggestions SET status='verified'", "UPDATE name_suggestions SET status='rejected'", "UPDATE name_suggestions SET proposer_id='u3'"]) {
    for (const existing of [false, true]) {
      const f = fixture();
      try {
        f.sqlite.exec("INSERT INTO name_endorsements(suggestion_id,user_id) VALUES('suggestion','u1'),('suggestion','u2')");
        if (existing) f.sqlite.exec("INSERT INTO name_endorsements(suggestion_id,user_id) VALUES('suggestion','u3')");
        f.beforeBatch(() => f.sqlite.exec(mutation));
        await assert.rejects(f.naming.endorseName("dish", "suggestion", "u3"), status(404));
        assert.equal(f.count("name_endorsements"), existing ? 3 : 2);
        assert.equal(f.count("dish_aliases"), 0);
        assert.equal(f.sqlite.prepare("SELECT naming_status FROM dishes WHERE id='dish'").get()!.naming_status, "unknown");
      } finally { f.sqlite.close(); }
    }
  }
});

test("concurrent endorsements promote exactly once, preserve verified dishes and alias provenance", async () => {
  for (const verified of [false, true]) {
    const f = fixture();
    try {
      f.sqlite.exec("INSERT INTO name_endorsements(suggestion_id,user_id) VALUES('suggestion','u1'),('suggestion','u2')");
      if (verified) f.sqlite.exec("UPDATE dishes SET naming_status='verified'; INSERT INTO dish_aliases(id,dish_id,name,normalized_name,source,language) VALUES('alias','dish','Custard','custard','admin','en')");
      const results = await Promise.all([f.naming.endorseName("dish", "suggestion", "u3"), f.naming.endorseName("dish", "suggestion", "u4")]);
      assert.deepEqual(results, [{ supporters: 3, status: "community" }, { supporters: 4, status: "community" }]);
      assert.equal(f.count("dish_aliases"), 1);
      assert.equal(f.count("name_endorsements"), 4);
      assert.equal(f.sqlite.prepare("SELECT naming_status FROM dishes WHERE id='dish'").get()!.naming_status, verified ? "verified" : "community");
      if (verified) assert.equal(f.sqlite.prepare("SELECT source FROM dish_aliases").get()!.source, "admin");
      await assert.rejects(f.naming.endorseName("dish", "suggestion", "u3"), status(409));
      await assert.rejects(f.naming.endorseName("dish", "suggestion", "u0"), status(409));
      await assert.rejects(f.naming.endorseName("dish", "missing", "u5"), status(404));
      assert.equal(f.count("name_endorsements"), 4);
    } finally { f.sqlite.close(); }
  }
});

test("endorsement batch rolls back admission and promotion when an alias write fails", async () => {
  const f = fixture();
  try {
    f.sqlite.exec(`INSERT INTO name_endorsements(suggestion_id,user_id) VALUES('suggestion','u1'),('suggestion','u2');
      CREATE TRIGGER fail_alias BEFORE INSERT ON dish_aliases BEGIN SELECT RAISE(ABORT,'alias unavailable'); END`);
    await assert.rejects(f.naming.endorseName("dish", "suggestion", "u3"), /alias unavailable/);
    assert.equal(f.count("name_endorsements"), 2);
    assert.equal(f.count("dish_aliases"), 0);
    assert.equal(f.sqlite.prepare("SELECT status FROM name_suggestions").get()!.status, "pending");
    assert.equal(f.sqlite.prepare("SELECT naming_status FROM dishes WHERE id='dish'").get()!.naming_status, "unknown");
  } finally { f.sqlite.close(); }
});

test("a duplicate cannot repair or promote state, while valid early endorsements report pending", async () => {
  const f = fixture();
  try {
    assert.deepEqual(await f.naming.endorseName("dish", "suggestion", "u1"), { supporters: 1, status: "pending" });
    f.sqlite.exec("INSERT INTO name_endorsements(suggestion_id,user_id) VALUES('suggestion','u2'),('suggestion','u3')");
    await assert.rejects(f.naming.endorseName("dish", "suggestion", "u1"), status(409));
    assert.equal(f.sqlite.prepare("SELECT status FROM name_suggestions").get()!.status, "pending");
    assert.equal(f.count("dish_aliases"), 0);
    f.sqlite.exec("UPDATE dishes SET naming_status='verified' WHERE id='dish'");
    assert.deepEqual(await f.naming.endorseName("dish", "suggestion", "u4"), { supporters: 4, status: "community" });
    assert.equal(f.count("dish_aliases"), 1);
    assert.equal(f.sqlite.prepare("SELECT naming_status FROM dishes WHERE id='dish'").get()!.naming_status, "verified");
  } finally { f.sqlite.close(); }
});
