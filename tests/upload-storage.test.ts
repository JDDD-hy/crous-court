import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

test("failed photo writes roll back, but a lost receipt never deletes committed photos", async () => {
  const source = stripTypeScriptTypes(readFileSync("lib/upload/upload-service.ts", "utf8").replace(/^import .*;\r?\n/gm, "")).replaceAll("export ", "");
  for (const failure of ["storage", "database", "receipt"]) {
    const deleted: string[] = []; let committed = false; let writes = 0;
    const db = {
      prepare(sql: string) { return { bind() { return this; }, async first() {
        if (sql.startsWith("SELECT meal_id")) return null;
        if (sql.startsWith("SELECT case_number")) throw new Error("receipt failed");
        return { display_number: 101, active: 1, timezone: "Europe/Paris", attempts: 1 };
      } }; },
      async batch() { if (failure === "database") throw new Error("database failed"); committed = true; },
    };
    const bucket = { async put() { if (++writes === 2 && failure === "storage") throw new Error("storage failed"); }, async delete(key: string) { deleted.push(key); } };
    const publish = new Function("getBindings", "todayInTimezone", "checkSanitizedImage", "catalogById", "catalogVenueInsert", source + "\nreturn publishMeal;")(
      () => ({ db, bucket }), () => "2026-09-15", async () => ({ width: 1, height: 1, bytes: new ArrayBuffer(1), mediaType: "image/jpeg" }), new Map([["test", { timezone: "Europe/Paris" }]]), () => ({}),
    ) as (form: FormData, user: string) => Promise<unknown>;
    const form = new FormData();
    for (const [key, value] of Object.entries({ venueId: "test", eatenOn: "2026-09-15", mainTier: "3", rightsConfirmed: "true" })) form.set(key, value);
    form.set("canonical", new File(["x"], "photo.jpg")); form.set("thumbnail", new File(["x"], "thumb.jpg"));
    await assert.rejects(publish(form, "test-user"));
    assert.equal(writes, 2);
    assert.equal(committed, failure === "receipt");
    assert.equal(deleted.length, committed ? 0 : 2, failure);
  }
});

test("historical or unknown venues cannot receive new uploads, even when the database identity is active", async () => {
  const source = stripTypeScriptTypes(readFileSync("lib/upload/upload-service.ts", "utf8").replace(/^import .*;\r?\n/gm, "")).replaceAll("export ", "");
  const directory = JSON.parse(readFileSync("data/national-venues.json", "utf8"));
  let bindingsRead = false;
  const publish = new Function("getBindings", "catalogById", source + "\nreturn publishMeal;")(
    () => { bindingsRead = true; throw new Error("must reject before database or storage access"); },
    new Map(directory.venues.map((venue: { id: string }) => [venue.id, venue])),
  ) as (form: FormData, user: string) => Promise<unknown>;
  for (const venueId of ["venue-escoffier", "venue-experimental", "unknown-venue"]) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ venueId, eatenOn: "2026-09-15", mainTier: "3", rightsConfirmed: "true" })) form.set(key, value);
    await assert.rejects(publish(form, "test-user"), /^Error: 餐厅不可用$/);
  }
  assert.equal(bindingsRead, false);
});
