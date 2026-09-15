import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

test("confirmed cafeteria migration preserves history, votes and next-upload uniqueness", () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql") && file < "0017").sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    db.exec(readFileSync("db/fixtures.sql", "utf8"));
    db.exec("INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) VALUES('existing-cafe','cafeteria-escoffier-2','fixture-user-01','2026-09-10','20260910-115-001',1)");
    const immutable = () => JSON.stringify([
      db.prepare("SELECT id,case_number,eaten_on,creator_id,status FROM meals ORDER BY id").all(),
      ...["dishes", "votes", "photos", "meal_items"].map(table => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()),
      db.prepare("SELECT id,dish_id,served_on,creator_id,initial_tier,original_description FROM servings ORDER BY id").all(),
    ]);
    const before = immutable();
    const migration = readFileSync("drizzle/0017_confirm_historical_cafeterias.sql", "utf8");
    db.exec(`BEGIN;${migration}COMMIT;`);
    assert.equal(immutable(), before);
    assert.equal(db.prepare("SELECT count(*) n FROM servings WHERE venue_id IN ('venue-escoffier','venue-experimental','ru-escoffier-2','ru-lexperimental-2')").get()!.n, 0);
    assert.equal(db.prepare("SELECT venue_id FROM meals WHERE id='fixture-meal-01'").get()!.venue_id, "cafeteria-escoffier-2");
    assert.equal(db.prepare("SELECT venue_id FROM meals WHERE id='fixture-meal-02'").get()!.venue_id, "cafeteria-lexperimental-2");
    assert.equal(db.prepare("SELECT count(*) n FROM meal_items mi JOIN meals m ON m.id=mi.meal_id JOIN servings s ON s.id=mi.serving_id WHERE m.venue_id<>s.venue_id OR m.eaten_on<>s.served_on").get()!.n, 0);
    const after = JSON.stringify(db.prepare("SELECT * FROM meals ORDER BY id").all());
    db.exec(migration);
    assert.equal(JSON.stringify(db.prepare("SELECT * FROM meals ORDER BY id").all()), after, "Rerun is harmless");
    db.exec("UPDATE daily_case_counters SET next_sequence=next_sequence+1 WHERE venue_id='cafeteria-escoffier-2' AND eaten_on='2026-09-10'; INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) SELECT 'next-upload',venue_id,'fixture-user-01',eaten_on,'20260910-115-'||printf('%03d',next_sequence),next_sequence FROM daily_case_counters WHERE venue_id='cafeteria-escoffier-2' AND eaten_on='2026-09-10'");
    assert.equal(db.prepare("SELECT display_order FROM meals WHERE id='next-upload'").get()!.display_order, 3);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { db.close(); }
});
