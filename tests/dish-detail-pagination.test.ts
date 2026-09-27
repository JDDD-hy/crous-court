import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { stripTypeScriptTypes } from "node:module";
import { and, desc, eq } from "drizzle-orm";
import { mealItems, meals, photos, servings, venues, votes } from "../db/schema.ts";
import { dishHistoryPageQueries, evidencePageSize, historyPageSize } from "../lib/dish-history-query.ts";

function fixture(source: string) {
  const calls = { summary: 0, history: 0, count: 0, evidence: 0 };
  const row = { id: "serving", mealId: "meal", date: "2026-09-27", initialTier: 3, originalDescription: "Dish", venueName: "Venue", venueNickname: "Venue", photoId: null };
  const db = { select() {
    const query = { from() { return query; }, innerJoin() { return query; }, leftJoin() { return query; }, where() { return query; }, orderBy() { return query; }, limit() { return query; }, async offset(offset: number) { calls.evidence++; return offset ? [] : [row]; } };
    return query;
  } };
  const rawDb = {
    prepare() { return { bind() { return { async first() { calls.count++; return { records: 1, sightings: 1 }; } }; } }; },
    async batch() { calls.history++; return [{ results: [{ page: 2, rows_json: JSON.stringify([{ tier: 3, at: "today", voteCount: 49, total: 80 }]) }] }]; },
  };
  const rankingPage = async () => { calls.summary++; return { dishes: [{ id: "dish" }] }; };
  const code = stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm, "").replace(/^export \{.*;\r?\n/gm, "")).replaceAll("export ", "");
  const detail = new Function("and", "desc", "eq", "getDb", "getRawDb", "mealItems", "meals", "photos", "servings", "venues", "votes", "getLocale", "rankingPage", "dishHistoryPageQueries", "evidencePageSize", "historyPageSize", code + "\nreturn getDishDetail;")(
    and, desc, eq, () => db, () => rawDb, mealItems, meals, photos, servings, venues, votes, async () => "en", rankingPage, dishHistoryPageQueries, evidencePageSize, historyPageSize,
  );
  return { calls, detail };
}

test("out-of-range evidence keeps history and avoids repeated summary/history/count work", async () => {
  const f = fixture(readFileSync("lib/ranking-service.ts", "utf8"));
  const result = await f.detail("dish", 10000, 2);
  assert.deepEqual(f.calls, { summary: 1, history: 1, count: 1, evidence: 2 });
  assert.equal(result.evidencePagination.page, 1);
  assert.equal(result.historyPagination.page, 2);
  assert.equal(result.historyPagination.total, 80);
  assert.equal(result.servings[0].id, "serving");
  assert.equal(result.tierHistory[0].voteCount, 49);
  const ordinary = fixture(readFileSync("lib/ranking-service.ts", "utf8"));
  assert.deepEqual(await ordinary.detail("dish", 1, 2), result);
  assert.deepEqual(ordinary.calls, { summary: 1, history: 1, count: 1, evidence: 1 });
  await assert.rejects(f.detail("dish", 0, 2), RangeError);
});

test("production baseline repeats three operations for the same fallback result", { skip: !process.env.CROUS_BASELINE_REF }, async () => {
  const baseline = fixture(execFileSync("git", ["show", `${process.env.CROUS_BASELINE_REF}:lib/ranking-service.ts`], { encoding: "utf8" }));
  const current = fixture(readFileSync("lib/ranking-service.ts", "utf8"));
  assert.deepEqual(await baseline.detail("dish", 10000, 2), await current.detail("dish", 10000, 2));
  assert.deepEqual(baseline.calls, { summary: 2, history: 2, count: 2, evidence: 2 });
});
