import assert from "node:assert/strict";

export async function verifyAiMergeReview({ request, admin, ordinary, sql }) {
  sql(`INSERT INTO dishes (id,original_description,category) VALUES
    ('merge-a','意面豆子加夹心肉排','main'),('merge-b','意面、豆子和夹心肉排','main'),
    ('merge-c','薯角配鱼排','main'),('merge-d','鱼排和薯角','main');
    INSERT INTO votes (id,dish_id,user_id,target_tier,created_at) VALUES
    ('merge-v1','merge-a','fixture-user-01',1,'2026-09-01'),
    ('merge-v2','merge-b','fixture-user-01',5,'2026-09-02'),
    ('merge-v3','merge-a','fixture-user-02',2,'2026-09-03'),
    ('merge-v4','merge-b','fixture-user-02',4,'2026-09-01'),
    ('merge-v5','merge-a','fixture-user-03',3,'2026-09-01');
    INSERT INTO dish_aliases(id,dish_id,name,normalized_name,source,created_by) VALUES ('merge-alias','merge-a','Cordon bleu pâtes','cordon bleu pâtes','admin','fixture-user-01');`);
  const action = (body, cookie = admin) => request("/api/admin/actions", "POST", body, cookie);
  assert.equal((await action({ action: "scan_merges" }, ordinary)).status, 403);
  assert.equal((await action({ action: "scan_merges" }, "")).status, 401);
  const invalid = await action({ action: "scan_merges" }); assert.equal(invalid.status, 502);
  const scanned = await action({ action: "scan_merges" }); const scan = await scanned.json();
  assert.equal(scanned.status, 200, JSON.stringify(scan)); assert.equal(scan.data.added, 2);
  const queue = await request("/api/admin/queue", "GET", undefined, admin).then((r) => r.json());
  const accepted = queue.data.suggestions.find((s) => s.source_id === "merge-a");
  const rejected = queue.data.suggestions.find((s) => s.source_id === "merge-c");
  assert.ok(accepted && rejected); assert.equal(accepted.source_name, "意面豆子加夹心肉排");
  assert.equal((await action({ action: "reject_merge", suggestionId: rejected.id })).status, 200);
  assert.equal((await action({ action: "accept_merge", suggestionId: rejected.id })).status, 409);
  const merge = await action({ action: "accept_merge", suggestionId: accepted.id }); assert.equal(merge.status, 200, await merge.text());
  assert.equal((await action({ action: "accept_merge", suggestionId: accepted.id })).status, 409);
  const repeated = await action({ action: "scan_merges" }).then((r) => r.json()); assert.equal(repeated.data.added, 0);
  assert.equal((await action({ action: "scan_merges" })).status, 429);
  const rows = sql("SELECT id,target_tier FROM votes WHERE dish_id='merge-b' ORDER BY id; SELECT status,reviewed_by,reviewed_at FROM ai_merge_suggestions ORDER BY source_id; SELECT dish_id FROM dish_aliases WHERE normalized_name='cordon bleu pâtes' ORDER BY dish_id; SELECT merged_into_dish_id FROM dishes WHERE id='merge-c';", true);
  assert.deepEqual(rows[0].results, [{ id: "merge-v1", target_tier: 1 }, { id: "merge-v4", target_tier: 4 }, { id: "merge-v5", target_tier: 3 }]);
  assert.deepEqual(rows[1].results.map((r) => r.status), ["accepted", "rejected"]);
  assert.ok(rows[1].results.every((r) => r.reviewed_by && r.reviewed_at));
  assert.deepEqual(rows[2].results.map((r) => r.dish_id), ["merge-a", "merge-b"]);
  assert.equal(rows[3].results[0].merged_into_dish_id, null);
  const final = await request("/api/admin/queue", "GET", undefined, admin).then((r) => r.json());
  assert.deepEqual(final.data.suggestions, []);
  console.log("AI merge review passed: authorization, invalid output, scan, persistent rejection, acceptance, repeat protection, throttling, vote/alias preservation.");
}
