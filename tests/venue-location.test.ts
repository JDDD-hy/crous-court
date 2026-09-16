import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { venueLocation } from "../lib/venue-location.ts";

test("all directory and migrated venues have compact postal locations; unknowns stay empty", () => {
  const directory = JSON.parse(readFileSync("data/versailles-venues.json", "utf8"));
  for (const venue of directory.venues) {
    const code = venue.id === "ru-escoffier-2" ? "91120" : venue.postalCode;
    assert.ok(venueLocation(venue.address, venue.id)?.startsWith(`${code} `), venue.id);
  }
  const db = new DatabaseSync(":memory:");
  try {
    for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    const rows = db.prepare("SELECT id,address FROM venues").all();
    assert.equal(rows.length, directory.venues.length + 2);
    for (const row of rows) assert.match(venueLocation(row.address as string | null, row.id as string)!, /^\d{5} .+$/, String(row.id));
  } finally { db.close(); }
  assert.equal(venueLocation("22, cours Pierre Vasseur - 31120 Palaiseau", "ru-escoffier-2"), "91120 Palaiseau");
  assert.equal(venueLocation("Street - 31120 Other town", "another-venue"), "31120 Other town");
  assert.equal(venueLocation("1 rue de Paris - 75005 Paris", "new-venue"), "75005 Paris");
  assert.equal(venueLocation("12 rue sans code", "unknown"), null);
  assert.equal(venueLocation(null, "unknown"), null);
  assert.equal(venueLocation("123456 Invalid", "unknown"), null);
});
