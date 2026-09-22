import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { dishHistoryQuery, historyPageSize } from "../lib/dish-history-query.ts";
import { buildTierHistory, previewVote, type Tier } from "../lib/ranking.ts";

test("paged SQL history exactly matches median replay, including ties and 10,000 transitions", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE votes(id TEXT, dish_id TEXT, target_tier INTEGER, created_at TEXT); CREATE INDEX history ON votes(dish_id,created_at,id,target_tier)");
  const insert = db.prepare("INSERT INTO votes VALUES(?,'dish',?,?)");
  const votes = Array.from({length: 10000}, (_,i)=>({tier: (i%2 ? 3 : 2) as Tier,at: String(Math.floor(i/3)).padStart(5,"0")}));
  db.exec("BEGIN");
  votes.forEach((v,i)=>insert.run(String(i).padStart(5,"0"),v.tier,v.at));
  db.exec("COMMIT");
  const expected = buildTierHistory(votes);
  for (const page of [1,2,Math.ceil(expected.length/historyPageSize)]) {
    const query=dishHistoryQuery("dish",page);
    const rows=db.prepare(query.sql).all(...query.bindings);
    assert.ok(rows.length<=historyPageSize);
    assert.equal(rows[0]?.total,expected.length);
    assert.deepEqual(rows.map(row=>({tier:row.tier,at:row.at,voteCount:row.voteCount})),expected.slice((page-1)*historyPageSize,page*historyPageSize));
  }
  assert.throws(()=>dishHistoryQuery("dish",-1));
  assert.equal(previewVote([0,1000000,1000000,0,0],null,2).tier,2);
  db.close();
});
