import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

test("extra side migration preserves existing meals and all slot safeguards", () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const file of readdirSync("drizzle").filter((file) => file.endsWith(".sql") && file < "0011").sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    db.exec(readFileSync("db/fixtures.sql", "utf8"));
    const before = db.prepare("SELECT * FROM meal_items ORDER BY meal_id, slot").all();
    db.exec(readFileSync("drizzle/0011_extra_side_dishes.sql", "utf8"));
    assert.deepEqual(db.prepare("SELECT * FROM meal_items ORDER BY meal_id, slot").all(), before);
    for (let slot = 2; slot <= 8; slot++) {
      db.exec(`INSERT INTO servings (id,dish_id,venue_id,served_on,creator_id,initial_tier) SELECT 'extra-${slot}',dish_id,venue_id,served_on,creator_id,3 FROM servings WHERE id='fixture-serving-03'`);
      db.exec(`INSERT INTO meal_items SELECT meal_id,'extra-${slot}','side_${slot}' FROM meal_items WHERE serving_id='fixture-serving-03'`);
    }
    assert.equal(db.prepare("SELECT count(*) AS count FROM meal_items WHERE slot='side_8'").get()?.count, 1);
    assert.throws(() => db.exec("UPDATE meal_items SET slot='side_9' WHERE slot='side_8'"), /CHECK/);
    assert.throws(() => db.exec("UPDATE meal_items SET slot='main' WHERE slot='side_8'"), /category/);
    assert.throws(() => db.exec("UPDATE meal_items SET serving_id='fixture-serving-01' WHERE slot='side_8'"), /category|venue\/date/);
    assert.throws(() => db.exec("UPDATE meal_items SET slot='side_1' WHERE slot='side_8'"), /UNIQUE/);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='trigger' AND tbl_name='meal_items'").get()?.count, 4);
  } finally { db.close(); }
});
