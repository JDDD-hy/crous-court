import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { calculateVerdict } from "../lib/ranking.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const persistPath = path.join(projectRoot, ".sites-runtime", "phase2-verification");
const wrangler = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const config = path.join(projectRoot, "dist", "server", "wrangler.json");

function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [wrangler, ...args], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(result.status, expectedStatus, result.stdout + result.stderr);
  return result.stdout;
}

const base = ["DB", "--local", "--persist-to", persistPath, "--config", config];

function execute(sql) {
  const output = run(["d1", "execute", ...base, "--command", sql, "--json"]);
  return JSON.parse(output)[0].results;
}

await rm(persistPath, { recursive: true, force: true });
run(["d1", "migrations", "apply", ...base]);
run(["d1", "migrations", "apply", ...base]);
run(["d1", "execute", ...base, "--file", path.join(projectRoot, "db", "fixtures.sql"), "--yes"]);

const tables = execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%' ORDER BY name").map((row) => row.name);
for (const table of ["auth_sessions", "daily_case_counters", "dishes", "email_otp_challenges", "meal_items", "meals", "photos", "servings", "users", "venues", "votes"]) assert.ok(tables.includes(table));

assert.deepEqual(execute("SELECT id, canonical_name, nickname, display_number, active FROM venues ORDER BY id"), [
  { id: "venue-escoffier", canonical_name: "Escoffier", nickname: "学校 CROUS / Télécom 附近", display_number: 0, active: 1 },
  { id: "venue-experimental", canonical_name: "L’Expérimental", nickname: "宿舍 CROUS / All Suites 附近", display_number: 1, active: 1 },
]);
assert.deepEqual(execute("PRAGMA foreign_key_check"), []);
assert.deepEqual(execute("SELECT category, count(*) AS count FROM dishes GROUP BY category ORDER BY category"), [
  { category: "main", count: 2 },
  { category: "side", count: 1 },
]);

execute("INSERT INTO votes (id,dish_id,user_id,target_tier) VALUES ('replacement','couscous-boulettes','fixture-user-01',5) ON CONFLICT(dish_id,user_id) DO UPDATE SET target_tier=excluded.target_tier, updated_at=CURRENT_TIMESTAMP");
assert.deepEqual(execute("SELECT count(*) AS count, target_tier FROM votes WHERE dish_id='couscous-boulettes' AND user_id='fixture-user-01'"), [{ count: 1, target_tier: 5 }]);
const updatedVerdict = calculateVerdict(execute("SELECT target_tier FROM votes WHERE dish_id='couscous-boulettes'").map((row) => row.target_tier));
assert.deepEqual(updatedVerdict, { tier: 2, voteCount: 5, status: "provisional", distribution: [0, 3, 1, 0, 1] });
execute("INSERT INTO meals (id,venue_id,creator_id,eaten_on,case_number,display_order) VALUES ('test-meal-side','venue-escoffier','fixture-user-01','2026-09-08','test-side',99),('test-meal-main','venue-escoffier','fixture-user-01','2026-09-10','test-main',99),('test-meal-cross','venue-experimental','fixture-user-01','2026-09-10','test-cross',99),('test-meal-date','venue-escoffier','fixture-user-01','2026-09-11','test-date',99)");

for (const invalidSql of [
  "INSERT INTO dishes (id,category) VALUES ('invalid-category','dessert')",
  "INSERT INTO votes (id,dish_id,user_id,target_tier) VALUES ('invalid-tier','couscous-boulettes','fixture-user-05',6)",
  "INSERT INTO votes (id,dish_id,user_id,target_tier) VALUES ('duplicate-vote','couscous-boulettes','fixture-user-02',2)",
  "INSERT INTO meal_items (meal_id,serving_id,slot) VALUES ('test-meal-side','fixture-serving-03','main')",
  "INSERT INTO meal_items (meal_id,serving_id,slot) VALUES ('test-meal-main','fixture-serving-01','side_1')",
  "INSERT INTO meal_items (meal_id,serving_id,slot) VALUES ('test-meal-cross','fixture-serving-01','main')",
  "INSERT INTO meal_items (meal_id,serving_id,slot) VALUES ('test-meal-date','fixture-serving-01','main')",
]) {
  const result = spawnSync(process.execPath, [wrangler, "d1", "execute", ...base, "--command", invalidSql], { cwd: projectRoot, encoding: "utf8" });
  assert.notEqual(result.status, 0, `constraint unexpectedly accepted: ${invalidSql}`);
}

console.log("Phase 2 D1 verification passed: fresh migration, repeat apply, seeds, FKs, category isolation, vote upsert/recalculation, and constraints.");
