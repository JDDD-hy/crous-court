import assert from "node:assert/strict";
import test from "node:test";
import { calculateVerdict, compareVerdicts, previewVote } from "../lib/ranking.ts";
import { reduceVoteState } from "../lib/vote-state.ts";
import type { DishSummary } from "../lib/dish-types.ts";

test("uses the worse middle tier for an even vote count", () => {
  assert.equal(calculateVerdict([1, 2, 5]).tier, 2);
  assert.equal(calculateVerdict([1, 2, 3, 4]).tier, 3);
  assert.equal(calculateVerdict([1, 2, 4, 5]).tier, 4);
  assert.equal(calculateVerdict([1, 1, 5, 5]).tier, 5);
});

test("recalculates after a user changes their target tier", () => {
  const votes = new Map([["a", 1], ["b", 2], ["c", 5]]);
  assert.equal(calculateVerdict([...votes.values()]).tier, 2);
  votes.set("b", 5);
  assert.equal(calculateVerdict([...votes.values()]).tier, 5);
  assert.equal(votes.size, 3);
});

test("assigns thresholds and a complete distribution", () => {
  assert.deepEqual(calculateVerdict([]), { tier: null, voteCount: 0, status: "pending", distribution: [0, 0, 0, 0, 0] });
  assert.equal(calculateVerdict([1, 2, 3, 4]).status, "pending");
  assert.equal(calculateVerdict([1, 2, 3, 4, 5]).status, "provisional");
  assert.equal(calculateVerdict(Array(14).fill(2)).status, "provisional");
  assert.equal(calculateVerdict(Array(15).fill(2)).status, "official");
  assert.deepEqual(calculateVerdict([1, 3, 3, 5]).distribution, [1, 0, 2, 0, 1]);
});

test("sorts by tier first and vote count second", () => {
  const stable = calculateVerdict([2, 2, 2, 2, 2]);
  const sparse = calculateVerdict([2]);
  const worse = calculateVerdict([3, 3, 3, 3, 3, 3]);
  assert.ok(compareVerdicts(stable, sparse) < 0);
  assert.ok(compareVerdicts(sparse, worse) < 0);
});

test("rejects invalid target tiers", () => {
  assert.throws(() => calculateVerdict([0, 3]), RangeError);
  assert.throws(() => calculateVerdict([2.5]), RangeError);
});

test("previews a first vote and a changed vote without double counting", () => {
  assert.deepEqual(previewVote([0, 1, 0, 0, 0], null, 5), {
    tier: 5, voteCount: 2, status: "pending", distribution: [0, 1, 0, 0, 1],
  });
  assert.deepEqual(previewVote([0, 1, 0, 0, 1], 5, 1), {
    tier: 2, voteCount: 2, status: "pending", distribution: [1, 1, 0, 0, 0],
  });
});

test("rolls optimistic vote state back after a failed request", () => {
  const dish = { id: "dish", name: "Dish", zh: "菜", venue: "Venue", date: "2026-09-11", image: "/dish.jpg", tier: 3, initialTier: 3, votes: 1, distribution: [0, 0, 1, 0, 0], category: "main", status: "pending" } satisfies DishSummary;
  const snapshot = { dish, myVote: 3 as const, error: "" };
  const optimistic = reduceVoteState(snapshot, { type: "optimistic", target: 1 });
  const rolledBack = reduceVoteState(optimistic, { type: "rollback", snapshot, error: "网络错误" });
  assert.deepEqual(rolledBack.dish, dish);
  assert.equal(rolledBack.myVote, 3);
  assert.equal(rolledBack.error, "网络错误");
});
