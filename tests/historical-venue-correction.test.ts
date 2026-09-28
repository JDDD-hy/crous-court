import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { archivedDishIds, correctHistoricalVenues, historicalMealMoves, restoredDishId, venueCorrectionId } from "../lib/historical-venue-correction.ts";

function fixture(empty = false) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("drizzle").filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
  const triggers = sqlite.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all();
  if (!empty) {
    // Restore an approved historical archive, whose unscoped votes predate the current write guards.
    for (const row of triggers) sqlite.exec(`DROP TRIGGER ${row.name}`);
    sqlite.exec("INSERT INTO users(id) VALUES('owner'),('reader-1'),('reader-2')");
    sqlite.prepare("INSERT INTO dishes(id,category,legacy_source_id) VALUES(?,'main',?)").run(restoredDishId, restoredDishId);
    for (const [index, [id, venue]] of historicalMealMoves.entries()) {
      sqlite.prepare("INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order,created_at) VALUES(?,?,'owner','2026-09-14',?,?,?)").run(id, venue, `original-${index}`, index + 1, `2026-09-14 12:00:0${index}`);
      const pasta = index === 2 ? 1 : index === 8 ? 0 : null;
      for (let slot = 0; slot < (index === 4 ? 4 : 3); slot++) {
        const special = slot === 0 && pasta !== null;
        const dish = special ? archivedDishIds[pasta] : `dish-${index}-${slot}`;
        const serving = special ? pasta === 0 ? "f2215e9e-b33d-4e3e-bb10-1f49383810f6" : "54af46ba-ff74-45bc-ad0a-717bdeb8128c" : `serving-${index}-${slot}`;
        const tier = special && pasta === 0 ? 2 : 3;
        sqlite.prepare("INSERT INTO dishes(id,venue_id,category,legacy_source_id,original_description) VALUES(?,?,?,?,?)").run(dish, venue, slot === 0 ? "main" : "side", special ? restoredDishId : null, `Original ${index}/${slot}`);
        sqlite.prepare("INSERT INTO servings(id,dish_id,venue_id,creator_id,served_on,initial_tier,original_description) VALUES(?,?,?,'owner','2026-09-14',?,?)").run(serving, dish, venue, tier, `Sighting ${index}/${slot}`);
        sqlite.prepare("INSERT INTO meal_items(meal_id,serving_id,slot) VALUES(?,?,?)").run(id, serving, slot === 0 ? "main" : `side_${slot}`);
        if (special) sqlite.prepare("INSERT INTO votes(id,dish_id,user_id,target_tier,source_serving_id) VALUES(?,?,'owner',?,?)").run(`generated-${pasta}`, dish, tier, serving);
      }
    }
    for (const [id, user, tier] of [
      ["104dfe09-8513-49bf-a2de-a628059b5cb6", "reader-1", 3],
      ["1f0e4251-503e-4d29-a640-f09f0eb93b98", "owner", 2],
      ["69961d21-1d83-4ac5-b5a9-cf87a73a0099", "reader-2", 3],
    ] as const) sqlite.prepare("INSERT INTO votes(id,dish_id,user_id,target_tier) VALUES(?,?,?,?)").run(id, restoredDishId, user, tier);
    sqlite.exec("INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) VALUES('existing','ru-lexperimental-2','owner','2026-09-14','KEEP-ME',100)");
    sqlite.exec("INSERT INTO daily_case_counters(eaten_on,venue_id,next_sequence) VALUES('2026-09-14','ru-lexperimental-2',110)");
    sqlite.prepare("INSERT INTO dish_history_pages(dish_id,page,rows_json) VALUES(?,1,'[]')").run(restoredDishId);
    for (const row of triggers) sqlite.exec(String(row.sql));
  }
  let batches = 0, failAt = -1;
  const api = {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      return { bind(...args: SQLInputValue[]) { values = args; return this; },
        async first() { return sqlite.prepare(sql).get(...values) ?? null; },
        async all() { return { results: sqlite.prepare(sql).all(...values) }; },
        run() { return sqlite.prepare(sql).run(...values); } };
    },
    async batch(statements: { run(): unknown }[]) {
      batches++; sqlite.exec("BEGIN");
      try { const results = statements.map((statement, i) => { if (i === failAt) throw Error("Injected database failure"); return statement.run(); }); sqlite.exec("COMMIT"); return results; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  const snapshot = () => JSON.stringify({ tables: ["meals", "servings", "dishes", "votes", "daily_case_counters", "app_data_migrations", "dish_history_pages"].map(table => sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all()), triggers: sqlite.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all() });
  return { sqlite, run: () => correctHistoricalVenues(api as unknown as D1Database), snapshot, batches: () => batches, failAt: (index: number) => { failAt = index; }, triggers };
}

test("owner correction moves whole trays, restores the three original votes and preserves guards/audit/case numbers", async () => {
  const f = fixture();
  try {
    const votes = f.sqlite.prepare("SELECT * FROM votes WHERE dish_id=? ORDER BY id").all(restoredDishId);
    const meals = f.sqlite.prepare("SELECT id,creator_id,eaten_on,case_number,created_at FROM meals ORDER BY id").all();
    const descriptions = f.sqlite.prepare("SELECT id,original_description,initial_tier,creator_id,served_on FROM servings ORDER BY id").all();
    await f.run();
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM votes ORDER BY id").all(), votes);
    assert.deepEqual(f.sqlite.prepare("SELECT id,creator_id,eaten_on,case_number,created_at FROM meals ORDER BY id").all(), meals);
    assert.deepEqual(f.sqlite.prepare("SELECT id,original_description,initial_tier,creator_id,served_on FROM servings ORDER BY id").all(), descriptions);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM servings WHERE dish_id=? AND venue_id='ru-lexperimental-2'").get(restoredDishId)!.n, 2);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM meals WHERE venue_id LIKE 'cafeteria-%'").get()!.n, 0);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM servings s JOIN dishes d ON d.id=s.dish_id WHERE s.venue_id IS NOT d.venue_id").get()!.n, 0);
    assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
    assert.deepEqual(f.sqlite.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all(), f.triggers);
    assert.throws(() => f.sqlite.prepare("UPDATE dishes SET venue_id='cafeteria-lexperimental-2' WHERE id=?").run(restoredDishId), /dish_venue_mismatch/);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM dish_history_pages").get()!.n, 0);
    const audit = JSON.parse(String(f.sqlite.prepare("SELECT details_json FROM app_data_migrations WHERE id=?").get(venueCorrectionId)!.details_json));
    assert.equal(audit.meals.length, 9); assert.equal(audit.servings.length, 28); assert.equal(audit.votes.length, 5);
    assert.equal(f.sqlite.prepare("SELECT display_order FROM meals WHERE id='existing'").get()!.display_order, 100);
    assert.equal(f.sqlite.prepare("SELECT next_sequence FROM daily_case_counters WHERE venue_id='ru-lexperimental-2'").get()!.next_sequence, 110);
    const before = f.snapshot(); await f.run(); assert.equal(f.snapshot(), before); assert.equal(f.batches(), 1);
  } finally { f.sqlite.close(); }
});

test("simultaneous worker initializations apply one correction and one audit", async () => {
  const f = fixture();
  try { await Promise.all([f.run(), f.run()]); assert.equal(f.sqlite.prepare("SELECT count(*) n FROM app_data_migrations WHERE id=?").get(venueCorrectionId)!.n, 1); assert.equal(f.sqlite.prepare("SELECT count(*) n FROM votes").get()!.n, 3); }
  finally { f.sqlite.close(); }
});

test("unexpected new votes or changed venue fail closed without dropping guards", async () => {
  for (const mutation of ["INSERT INTO votes(id,dish_id,user_id,target_tier) VALUES('new','c96d8770c6fbabc39adb9f115c50746a','reader-1',4)", "UPDATE meals SET venue_id='ru-escoffier-2' WHERE id='0b1e3613-1a54-463c-b2f0-3f9bb210520f'"]) {
    const f = fixture();
    try { f.sqlite.exec(mutation); const before = f.snapshot(); await assert.rejects(f.run(), /NOT NULL/); assert.equal(f.snapshot(), before); }
    finally { f.sqlite.close(); }
  }
});

test("failure after mutations rolls back records, audit, and temporarily removed triggers", async () => {
  const f = fixture();
  try { const before = f.snapshot(); f.failAt(9); await assert.rejects(f.run(), /Injected/); assert.equal(f.snapshot(), before); f.failAt(-1); await f.run(); }
  finally { f.sqlite.close(); }
});

test("fresh database with none of the historical records remains usable", async () => {
  const f = fixture(true);
  try { await f.run(); await f.run(); assert.equal(f.batches(), 1); assert.equal(f.sqlite.prepare("SELECT count(*) n FROM meals").get()!.n, 0); assert.deepEqual(f.sqlite.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all(), f.triggers); }
  finally { f.sqlite.close(); }
});
