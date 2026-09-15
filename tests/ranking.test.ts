import assert from "node:assert/strict";
import test from "node:test";
import { buildTierHistory, calculateVerdict, compareVerdicts, previewVote } from "../lib/ranking.ts";
import { reduceVoteState } from "../lib/vote-state.ts";
import type { DishSummary } from "../lib/dish-types.ts";
import { firstUnreviewedIndex, nextDefendantIndex } from "../lib/defendant-rotation.ts";
import { getVerdictMotion } from "../lib/verdict-motion.ts";

test("uses the worse middle tier for an even vote count", () => {
  assert.equal(calculateVerdict([1, 2, 5]).tier, 2);
  assert.equal(calculateVerdict([1, 2, 3, 4]).tier, 3);
  assert.equal(calculateVerdict([1, 2, 4, 5]).tier, 4);
  assert.equal(calculateVerdict([1, 1, 5, 5]).tier, 5);
});

test("assigns thresholds and a complete distribution", () => {
  assert.deepEqual(calculateVerdict([]), { tier: null, voteCount: 0, status: "pending", distribution: [0, 0, 0, 0, 0] });
  assert.equal(calculateVerdict([1, 2, 3, 4]).status, "pending");
  assert.equal(calculateVerdict([1, 2, 3, 4, 5]).status, "provisional");
  assert.equal(calculateVerdict(Array(14).fill(2)).status, "provisional");
  assert.equal(calculateVerdict(Array(15).fill(2)).status, "official");
  assert.deepEqual(calculateVerdict([1, 3, 3, 5]).distribution, [1, 0, 2, 0, 1]);
});

test("records only real median-tier movements in vote order", () => {
  assert.deepEqual(buildTierHistory([
    { tier: 3, at: "2026-09-10 12:00:00" },
    { tier: 5, at: "2026-09-10 12:01:00" },
    { tier: 1, at: "2026-09-10 12:02:00" },
    { tier: 1, at: "2026-09-10 12:03:00" },
  ]), [
    { tier: 3, at: "2026-09-10 12:00:00", voteCount: 1 },
    { tier: 5, at: "2026-09-10 12:01:00", voteCount: 2 },
    { tier: 3, at: "2026-09-10 12:02:00", voteCount: 3 },
  ]);
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

test("previews a first vote", () => {
  assert.deepEqual(previewVote([0, 1, 0, 0, 0], null, 5), {
    tier: 5, voteCount: 2, status: "pending", distribution: [0, 1, 0, 0, 1],
  });
});

test("rolls optimistic vote state back after a failed request", () => {
  const dish = { id: "dish", name: "Dish", zh: "菜", venue: "Venue", date: "2026-09-11", image: "/dish.jpg", tier: 3, initialTier: 3, votes: 1, distribution: [0, 0, 1, 0, 0], category: "main", status: "pending" } satisfies DishSummary;
  const snapshot = { dish, myVote: null, error: "" };
  const optimistic = reduceVoteState(snapshot, { type: "optimistic", target: 1 });
  const rolledBack = reduceVoteState(optimistic, { type: "rollback", snapshot, error: "网络错误" });
  assert.deepEqual(rolledBack.dish, dish);
  assert.equal(rolledBack.myVote, null);
  assert.equal(rolledBack.error, "网络错误");
});

test("does not optimistically replace an existing vote", () => {
  const dish = { id: "dish", name: "Dish", zh: "菜", venue: "Venue", date: "2026-09-11", image: "/dish.jpg", tier: 3, initialTier: 3, votes: 1, distribution: [0, 0, 1, 0, 0], category: "main", status: "pending" } satisfies DishSummary;
  const state = { dish, myVote: 3 as const, error: "" };
  assert.equal(reduceVoteState(state, { type: "optimistic", target: 1 }), state);
});

test("confirmed votes preserve the selected venue observation while updating global scores", () => {
  const dish = { id: "dish", name: "Dish", zh: "菜", venue: "Escoffier", date: "2026-09-11", image: "/local.jpg", tier: 3, initialTier: 3, votes: 1, distribution: [0, 0, 1, 0, 0], category: "main", status: "pending" } satisfies DishSummary;
  const result = reduceVoteState({ dish, myVote: null, error: "" }, { type: "confirmed", myVote: 1, dish: { ...dish, venue: "Experimental", date: "2026-09-15", image: "/other.jpg", initialTier: 5, votes: 2, distribution: [1, 0, 1, 0, 0] } });
  assert.equal(result.dish.venue, "Escoffier");
  assert.equal(result.dish.date, "2026-09-11");
  assert.equal(result.dish.image, "/local.jpg");
  assert.equal(result.dish.initialTier, 3);
  assert.equal(result.dish.votes, 2);
  assert.deepEqual(result.dish.distribution, [1, 0, 1, 0, 0]);
});

test("cycles defendants in both directions", () => {
  assert.equal(nextDefendantIndex(0, 3), 1);
  assert.equal(nextDefendantIndex(2, 3), 0);
  assert.equal(nextDefendantIndex(0, 3, -1), 2);
  assert.equal(nextDefendantIndex(0, 0), 0);
});

test("starts each account on its first unreviewed defendant", () => {
  const dishes = ["dish-a", "dish-b", "dish-c"];
  assert.equal(firstUnreviewedIndex(dishes, { "dish-a": 2 }), 1);
  assert.equal(firstUnreviewedIndex(dishes, { "dish-a": 2, "dish-b": 4 }), 2);
  assert.equal(firstUnreviewedIndex(dishes, { "dish-a": 2, "dish-b": 4, "dish-c": 1 }), 0);
});

test("only shatters on a major downgrade or first entry into the worst tier", () => {
  assert.equal(getVerdictMotion(1, 3).shatter, true);
  assert.equal(getVerdictMotion(3, 5).shatter, true);
  assert.equal(getVerdictMotion(4, 5).shatter, true);
  assert.equal(getVerdictMotion(2, 3).shatter, false);
  assert.equal(getVerdictMotion(2, 2).shatter, false);
  assert.equal(getVerdictMotion(null, 5).shatter, false);
});
