import assert from "node:assert/strict";
import test from "node:test";
import { todayInParis, todayAndYesterdayInParis } from "../lib/calendar.ts";

test("uses the Paris calendar day at timezone boundaries", () => {
  assert.equal(todayInParis(new Date("2026-01-01T22:30:00Z")), "2026-01-01");
  assert.equal(todayInParis(new Date("2026-07-01T22:30:00Z")), "2026-07-02");
});

test("court dates use two Paris calendar days across midnight, leap day and DST", () => {
  for (const [now, expected] of [
    ["2026-09-14T12:00:00Z", ["2026-09-14", "2026-09-13"]],
    ["2026-07-01T22:30:00Z", ["2026-07-02", "2026-07-01"]],
    ["2025-12-31T23:30:00Z", ["2026-01-01", "2025-12-31"]],
    ["2024-03-01T12:00:00Z", ["2024-03-01", "2024-02-29"]],
    ["2026-03-29T22:30:00Z", ["2026-03-30", "2026-03-29"]],
    ["2026-10-25T23:30:00Z", ["2026-10-26", "2026-10-25"]],
  ] as const) assert.deepEqual(todayAndYesterdayInParis(new Date(now)), expected);
});
