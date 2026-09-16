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
        return { display_number: 101, attempts: 1 };
      } }; },
      async batch() { if (failure === "database") throw new Error("database failed"); committed = true; },
    };
    const bucket = { async put() { if (++writes === 2 && failure === "storage") throw new Error("storage failed"); }, async delete(key: string) { deleted.push(key); } };
    const publish = new Function("getBindings", "todayInParis", "checkSanitizedImage", source + "\nreturn publishMeal;")(
      () => ({ db, bucket }), () => "2026-09-15", async () => ({ width: 1, height: 1, bytes: new ArrayBuffer(1), mediaType: "image/jpeg" }),
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
