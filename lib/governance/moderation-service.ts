import { getSplitVoteRepairs, repairSplitVote, splitServing } from "./split-serving";
import { mergeDish } from "./merge-dish";
import { getRawDb } from "@/db";
import { GovernanceError } from "./errors";
import { enforceGovernanceLimit } from "./rate-limit";
import { getMergeSuggestions, rejectMergeSuggestion, scanMergeSuggestions } from "@/lib/ai/merge-review";

const reasons = new Set(["privacy", "not_food", "abuse", "wrong_dish", "other"]);

export async function createReport(userId: string, input: Record<string, unknown>) {
  await enforceGovernanceLimit(userId, "report", 10);
  if (typeof input.reason !== "string" || !reasons.has(input.reason)) throw new GovernanceError("请选择举报原因");
  const mealTarget = input.reason === "privacy" || input.reason === "not_food" || input.reason === "abuse";
  const dishId = typeof input.dishId === "string" ? input.dishId : null;
  const mealId = typeof input.mealId === "string" ? input.mealId : null;
  if ((mealTarget && !mealId) || (!mealTarget && !dishId)) throw new GovernanceError("举报对象无效");
  const details = typeof input.details === "string" ? input.details.trim().slice(0, 500) : "";
  const db = getRawDb();
  const exists = mealTarget
    ? await db.prepare("SELECT id FROM meals WHERE id = ?").bind(mealId).first()
    : await db.prepare("SELECT id FROM dishes WHERE id = ?").bind(dishId).first();
  if (!exists) throw new GovernanceError("举报对象不存在", 404);
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO reports (id,reporter_id,dish_id,meal_id,reason,details) VALUES (?,?,?,?,?,?)").bind(id, userId, mealTarget ? null : dishId, mealTarget ? mealId : null, input.reason, details || null).run();
  return { id, status: "open" };
}

export async function getAdminQueue() {
  const db = getRawDb();
  const [reportRows, nameRows, mergedRows] = await Promise.all([
    db.prepare("SELECT id,dish_id,meal_id,reason,details,status,created_at FROM reports WHERE status = 'open' ORDER BY created_at ASC").all(),
    db.prepare(`SELECT ns.id,ns.dish_id,ns.name,ns.evidence_type,ns.evidence_note,ns.status,count(ne.user_id) supporters
      FROM name_suggestions ns LEFT JOIN name_endorsements ne ON ne.suggestion_id=ns.id
      WHERE ns.status IN ('pending','community') GROUP BY ns.id ORDER BY ns.created_at ASC`).all(),
    db.prepare("SELECT id,merged_into_dish_id FROM dishes WHERE merged_into_dish_id IS NOT NULL ORDER BY created_at DESC LIMIT 30").all(),
  ]);
  return { reports: reportRows.results, names: nameRows.results, merges: mergedRows.results, suggestions: await getMergeSuggestions(), splitRepairs: await getSplitVoteRepairs() };
}

export async function moderate(adminId: string, input: Record<string, unknown>) {
  if (typeof input.action !== "string") throw new GovernanceError("管理操作无效");
  const handlers: Record<string, () => Promise<Record<string, unknown>>> = {
    resolve_report: () => resolveReport(adminId, String(input.reportId ?? ""), "resolved"),
    dismiss_report: () => resolveReport(adminId, String(input.reportId ?? ""), "dismissed"),
    hide_meal: () => hideMeal(adminId, String(input.mealId ?? "")),
    verify_name: () => verifyName(adminId, String(input.suggestionId ?? ""), String(input.language ?? "other")),
    merge_dish: () => mergeDish(adminId, String(input.sourceDishId ?? ""), String(input.targetDishId ?? "")),
    split_serving: () => splitServing(adminId, String(input.servingId ?? ""), typeof input.name === "string" ? input.name : ""),
    repair_split_vote: () => repairSplitVote(adminId, String(input.servingId ?? "")),
    scan_merges: () => scanMergeSuggestions(adminId),
    reject_merge: () => rejectMergeSuggestion(adminId, String(input.suggestionId ?? "")),
    accept_merge: async () => {
      const suggestion = await getRawDb().prepare("SELECT source_id,target_id FROM ai_merge_suggestions WHERE id=? AND status='pending'").bind(String(input.suggestionId ?? "")).first<{ source_id: string; target_id: string }>();
      if (!suggestion) throw new GovernanceError("建议已处理，请刷新", 409);
      return mergeDish(adminId, suggestion.source_id, suggestion.target_id, String(input.suggestionId));
    },
  };
  const handler = Object.hasOwn(handlers, input.action) ? handlers[input.action] : undefined;
  if (!handler) throw new GovernanceError("管理操作无效");
  return handler();
}

async function resolveReport(adminId: string, reportId: string, status: "resolved" | "dismissed") {
  const db = getRawDb();
  const [changed] = await db.batch([
    db.prepare("UPDATE reports SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'open'").bind(status, reportId),
    audit(adminId, status === "resolved" ? "resolve_report" : "dismiss_report", "report", reportId, {}, true),
  ]);
  if (changed.meta.changes !== 1) throw new GovernanceError("举报不存在或已经处理", 404);
  return { reportId, status };
}

async function hideMeal(adminId: string, mealId: string) {
  const db = getRawDb();
  const [changed] = await db.batch([
    db.prepare("UPDATE meals SET status = 'hidden' WHERE id = ? AND status = 'active'").bind(mealId),
    audit(adminId, "hide_meal", "meal", mealId, {}, true),
  ]);
  if (changed.meta.changes !== 1) throw new GovernanceError("餐次不存在或已经隐藏", 404);
  return { mealId, status: "hidden" };
}

async function verifyName(adminId: string, suggestionId: string, language: string) {
  if (!new Set(["fr", "en", "zh", "other"]).has(language)) throw new GovernanceError("名称语言无效");
  const db = getRawDb();
  const row = await db.prepare("SELECT dish_id,name,normalized_name FROM name_suggestions WHERE id = ? AND status <> 'rejected'").bind(suggestionId).first<{ dish_id: string; name: string; normalized_name: string }>();
  if (!row) throw new GovernanceError("名称候选不存在", 404);
  const canonicalColumn = language === "en" ? "canonical_name_en" : language === "fr" ? "canonical_name_fr" : language === "zh" ? "canonical_name_zh" : null;
  await db.batch([
    db.prepare("UPDATE name_suggestions SET status = 'verified' WHERE id = ?").bind(suggestionId),
    canonicalColumn
      ? db.prepare(`UPDATE dishes SET ${canonicalColumn} = ?, naming_status = 'verified' WHERE id = ?`).bind(row.name, row.dish_id)
      : db.prepare("UPDATE dishes SET naming_status = 'verified' WHERE id = ?").bind(row.dish_id),
    db.prepare("INSERT INTO dish_aliases (id,dish_id,name,normalized_name,language,source,created_by) VALUES (?,?,?,?,?,'admin',?) ON CONFLICT(dish_id,normalized_name) DO UPDATE SET source='admin',language=excluded.language").bind(crypto.randomUUID(), row.dish_id, row.name, row.normalized_name, language, adminId),
    audit(adminId, "verify_name", "suggestion", suggestionId, { dishId: row.dish_id, language }),
  ]);
  return { suggestionId, dishId: row.dish_id, status: "verified" };
}

function audit(adminId: string, action: string, targetType: string, targetId: string, details: object, onlyIfChanged = false) {
  // Conditional audit must immediately follow its UPDATE in the same D1 batch.
  return getRawDb().prepare(`INSERT INTO moderation_actions (id,admin_id,action,target_type,target_id,details_json) SELECT ?,?,?,?,?,?${onlyIfChanged ? " WHERE changes() = 1" : ""}`)
    .bind(crypto.randomUUID(), adminId, action, targetType, targetId, JSON.stringify(details));
}
