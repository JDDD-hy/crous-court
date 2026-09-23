import assert from "node:assert/strict";
import { test } from "node:test";
import { validateMergePairs } from "../lib/ai/merge-review-schema.ts";

test("AI merge pairs reject invented IDs, cross-category pairs and malformed results; deduplicate reverse pairs", () => {
  const dishes = [{ id: "a", category: "main", venue_id: "one" }, { id: "b", category: "main", venue_id: "one" }, { id: "c", category: "side", venue_id: "one" }, { id: "other-venue", category: "main", venue_id: "two" }];
  const pair = { sourceId: "a", targetId: "b", reason: "相同搭配，连接词不同", uncertainty: "肉排馅料需看照片" };
  assert.equal(validateMergePairs({ pairs: [pair, { ...pair, sourceId: "b", targetId: "a" }] }, dishes).length, 1);
  for (const targetId of ["a", "c", "invented", "other-venue"]) assert.throws(() => validateMergePairs({ pairs: [{ ...pair, targetId }] }, dishes));
  assert.throws(() => validateMergePairs({ pairs: [{ ...pair, uncertainty: "" }] }, dishes));
  assert.throws(() => validateMergePairs({ pairs: [pair], execute: true }, dishes));
  assert.deepEqual(validateMergePairs({ pairs: [] }, dishes), []);
});
