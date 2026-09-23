import test from "node:test";
import assert from "node:assert/strict";
import { reportServerError } from "../lib/server-error.ts";

test("server error logs preserve correlation and classify causes without raw details", (t) => {
  const lines: string[] = [];
  t.mock.method(console, "error", (line: string) => lines.push(line));
  const error = new Error("Failed query: SELECT private-email-and-token", { cause: new Error("D1_ERROR: D1 DB is overloaded. Requests queued for too long.") });
  reportServerError("vote", "request-1", error);
  assert.deepEqual(JSON.parse(lines[0]), { event: "server_error", operation: "vote", requestId: "request-1", categories: ["unclassified", "d1_overloaded"] });
  assert.ok(!lines[0].includes("private-email-and-token"));
  error.cause = error;
  reportServerError("ranking", "request-2", error);
  assert.deepEqual(JSON.parse(lines[1]).categories, ["unclassified"]);
  reportServerError("isolation_init", "request-3", "secret string");
  assert.ok(!lines[2].includes("secret string"));
});
