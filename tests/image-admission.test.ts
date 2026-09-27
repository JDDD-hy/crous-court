import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { GovernanceError } from "../lib/governance/errors.ts";
import { BodyTooLargeError, InvalidBodyError, cancelRequestBody, parseLimitedFormData } from "../lib/http/read-limited-body.ts";

function source(file: string) {
  return stripTypeScriptTypes(readFileSync(file, "utf8").replace(/^import .*;\r?\n/gm, "")).replaceAll("export ", "");
}

function admission() {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
  sqlite.exec(readFileSync("db/fixtures.sql", "utf8"));
  let now = 10000;
  const db = { prepare(sql: string) {
    let values: SQLInputValue[] = [];
    return {
      bind(...args: SQLInputValue[]) { values = args; return this; },
      async first() {
        // Allow all competing requests to reach the database before executing.
        await new Promise<void>(resolve => setImmediate(resolve));
        return sqlite.prepare(sql).get(...values) ?? null;
      },
    };
  } };
  const enforce = new Function("getRawDb", "GovernanceError", "Date", source("lib/governance/rate-limit.ts") + "\nreturn enforceGovernanceLimit;")(
    () => db, GovernanceError, { now: () => now * 1000 },
  ) as (user: string, action: string, limit: number, windowSeconds?: number) => Promise<void>;
  return { sqlite, enforce, setNow: (value: number) => { now = value; } };
}

test("atomic image admission bounds concurrent attempts and isolates user/action windows", async () => {
  const { sqlite, enforce, setNow } = admission();
  try {
    const results = await Promise.allSettled(Array.from({ length: 50 }, () => enforce("fixture-user-01", "upload_body", 30, 60)));
    assert.equal(results.filter(result => result.status === "fulfilled").length, 30);
    for (const result of results) if (result.status === "rejected") {
      assert.ok(result.reason instanceof GovernanceError);
      assert.equal(result.reason.status, 429);
    }
    assert.equal(sqlite.prepare("SELECT attempts FROM governance_rate_limits WHERE user_id=? AND action=?").get("fixture-user-01", "upload_body")!.attempts, 30);
    await enforce("fixture-user-02", "upload_body", 30, 60);
    await enforce("fixture-user-01", "identify_body", 30, 60);
    setNow(10059);
    await assert.rejects(enforce("fixture-user-01", "upload_body", 30, 60), GovernanceError);
    setNow(10060);
    await enforce("fixture-user-01", "upload_body", 30, 60);
    assert.equal(sqlite.prepare("SELECT attempts FROM governance_rate_limits WHERE user_id=? AND action=?").get("fixture-user-01", "upload_body")!.attempts, 1);
    await enforce("fixture-user-01", "report", 1);
    setNow(10120);
    await assert.rejects(enforce("fixture-user-01", "report", 1), GovernanceError);
    setNow(13660);
    await enforce("fixture-user-01", "report", 1);
  } finally { sqlite.close(); }
});

class AuthError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
class IdentificationError extends AuthError {}
class ImageValidationError extends Error {}
class UploadInputError extends Error {}

function route(file: string, enforce: ReturnType<typeof admission>["enforce"], events: string[], authenticated = true) {
  const dependencies = {
    localizedJson: (body: unknown, init?: ResponseInit) => Response.json(body, init),
    assertSameOrigin: () => { events.push("origin"); },
    getEmailUser: async () => { events.push("auth"); return authenticated ? { userId: "fixture-user-01" } : null; },
    enforceGovernanceLimit: async (...args: Parameters<typeof enforce>) => { events.push("admission"); await enforce(...args); },
    parseLimitedFormData: async (...args: Parameters<typeof parseLimitedFormData>) => { events.push("parse"); return parseLimitedFormData(...args); },
    publishMeal: async () => { events.push("publish"); return { mealId: "test", translationCandidates: [] }; },
    identifyDish: async () => { events.push("identify"); return { cached: true }; },
    after: () => {}, translateDishNames: () => {},
    AuthError, IdentificationError, ImageValidationError, UploadInputError, GovernanceError,
    BodyTooLargeError, InvalidBodyError, cancelRequestBody,
  };
  return new Function(...Object.keys(dependencies), source(file) + "\nreturn POST;")(...Object.values(dependencies)) as (request: Request) => Promise<Response>;
}

for (const [file, action, service, success] of [
  ["app/api/uploads/route.ts", "upload_body", "publish", 201],
  ["app/api/ai/identify/route.ts", "identify_body", "identify", 200],
] as const) {
  test(`image routes reject ${action} before reading, despite hanging cancellation`, { timeout: 2000 }, async () => {
    const { sqlite, enforce } = admission();
    try {
      await Promise.all(Array.from({ length: 30 }, () => enforce("fixture-user-01", action, 30, 60)));
      const events: string[] = [];
      let reads = 0;
      let cancelled = false;
      const body = new ReadableStream({
        pull() { reads++; },
        cancel() { cancelled = true; return new Promise<void>(() => {}); },
      }, { highWaterMark: 0 });
      const request = new Request("https://example.test", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=test" }, body, duplex: "half" } as RequestInit);
      const response = await route(file, enforce, events)(request);
      assert.equal(response.status, 429);
      assert.deepEqual(events, ["origin", "auth", "admission"]);
      assert.equal(reads, 0);
      assert.equal(cancelled, true);
      if (action === "identify_body") assert.equal(response.headers.get("cache-control"), "no-store");
    } finally { sqlite.close(); }
  });

  test(`image routes retain auth, valid multipart and service behavior for ${action}`, async () => {
    const { sqlite, enforce } = admission();
    try {
      const events: string[] = [];
      const unauthorized = await route(file, enforce, events, false)(new Request("https://example.test", { method: "POST", body: "ignored" }));
      assert.equal(unauthorized.status, 401);
      assert.deepEqual(events, ["origin", "auth"]);
      events.length = 0;
      const malformed = await route(file, enforce, events)(new Request("https://example.test", { method: "POST", body: "not multipart" }));
      assert.equal(malformed.status, 415);
      assert.deepEqual(events, ["origin", "auth", "admission", "parse"]);
      assert.equal(sqlite.prepare("SELECT attempts FROM governance_rate_limits WHERE user_id=? AND action=?").get("fixture-user-01", action)!.attempts, 1);
      events.length = 0;
      const form = new FormData();
      form.set("image", new File(["test"], "photo.jpg", { type: "image/jpeg" }));
      const response = await route(file, enforce, events)(new Request("https://example.test", { method: "POST", body: form }));
      assert.equal(response.status, success);
      assert.deepEqual(events, ["origin", "auth", "admission", "parse", service]);
      assert.equal(sqlite.prepare("SELECT attempts FROM governance_rate_limits WHERE user_id=? AND action=?").get("fixture-user-01", action)!.attempts, 2);
    } finally { sqlite.close(); }
  });
}
