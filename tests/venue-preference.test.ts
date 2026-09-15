import { test } from "node:test";
import assert from "node:assert/strict";
import { nearbyVenues, matchVenue, type VenueOption } from "../lib/venue-preference.ts";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

test("nearby scope excludes far, invalid and legacy venues and preserves distance order", () => {
  const option = (id: string, latitude: number, legacy = false): VenueOption => ({ id, name: id, address: "Palaiseau", points: [{ latitude, longitude: 2 }], legacy });
  const options = [option("far", 48.02), option("second", 48.005), option("first", 48.001), option("legacy", 48, true), option("bad", 100)];
  assert.deepEqual(nearbyVenues(options, { latitude: 48, longitude: 2 }).map(item => item.option.id), ["first", "second"]);
  assert.deepEqual(nearbyVenues(options, { latitude: NaN, longitude: 2 }), []);
  assert.equal(matchVenue({ ...options[0], name: "Cafétéria L’Expérimental" }, "cafeteria"), true);
  assert.equal(matchVenue(options[0], "palaiseau"), true);
});

test("official directory migration preserves historical venue ownership and has unique case numbers", () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql") && file < "0016").sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    db.exec(readFileSync("db/fixtures.sql", "utf8"));
    const before = db.prepare("SELECT id,venue_id FROM servings ORDER BY id").all();
    db.exec(readFileSync("drizzle/0016_official_venues.sql", "utf8"));
    assert.deepEqual(db.prepare("SELECT id,venue_id FROM servings ORDER BY id").all(), before);
    assert.equal(db.prepare("SELECT count(*) n FROM venues").get()!.n, 68);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { db.close(); }
});
