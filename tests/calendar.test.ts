import assert from "node:assert/strict";
import test from "node:test";
import { todayInParis } from "../lib/calendar.ts";

test("uses the Paris calendar day at timezone boundaries", () => {
  assert.equal(todayInParis(new Date("2026-01-01T22:30:00Z")), "2026-01-01");
  assert.equal(todayInParis(new Date("2026-07-01T22:30:00Z")), "2026-07-02");
});
