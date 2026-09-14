import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

test("vote migration preserves legacy votes and blocks stale merged targets and false initial provenance", () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql") && file < "0013").sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    db.exec(readFileSync("db/fixtures.sql", "utf8"));
    const before = db.prepare("SELECT id,dish_id,user_id,target_tier FROM votes ORDER BY id").all();
    db.exec(readFileSync("drizzle/0013_vote_provenance.sql", "utf8"));
    assert.deepEqual(db.prepare("SELECT id,dish_id,user_id,target_tier FROM votes ORDER BY id").all(), before);
    assert.throws(() => db.exec("UPDATE votes SET source_serving_id='fixture-serving-01' WHERE id='fixture-vote-c-01'"), /invalid_vote_source/);
    db.exec("UPDATE votes SET source_serving_id='fixture-serving-02' WHERE id='fixture-vote-l-02'");
    db.exec("UPDATE dishes SET merged_into_dish_id='couscous-boulettes' WHERE id='lentilles-saucisse'");
    assert.throws(() => db.exec("INSERT INTO votes(id,dish_id,user_id,target_tier) VALUES('stale','lentilles-saucisse','fixture-user-05',2)"), /dish_no_longer_active/);
    assert.throws(() => db.exec("UPDATE votes SET dish_id='lentilles-saucisse' WHERE id='fixture-vote-c-05'"), /dish_no_longer_active/);
    assert.throws(() => db.exec("UPDATE servings SET dish_id='lentilles-saucisse' WHERE id='fixture-serving-01'"), /dish_no_longer_active/);
    assert.throws(() => db.exec("INSERT INTO servings(id,dish_id,venue_id,served_on,creator_id,initial_tier) SELECT 'stale-serving',dish_id,venue_id,served_on,creator_id,3 FROM servings WHERE id='fixture-serving-02'"), /dish_no_longer_active/);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { db.close(); }
});
