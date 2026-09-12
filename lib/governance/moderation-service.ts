import { getRawDb } from "@/db";
import { GovernanceError } from "./errors";
import { normalizeDishName } from "./name-utils";
import { enforceGovernanceLimit } from "./rate-limit";

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
  return { reports: reportRows.results, names: nameRows.results, merges: mergedRows.results };
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
  };
  const handler = handlers[input.action];
  if (!handler) throw new GovernanceError("管理操作无效");
  return handler();
}

async function resolveReport(adminId: string, reportId: string, status: "resolved" | "dismissed") {
  const db = getRawDb();
  const changed = await db.prepare("UPDATE reports SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'open'").bind(status, reportId).run();
  if (changed.meta.changes !== 1) throw new GovernanceError("举报不存在或已经处理", 404);
  await audit(adminId, status === "resolved" ? "resolve_report" : "dismiss_report", "report", reportId, {});
  return { reportId, status };
}

async function hideMeal(adminId: string, mealId: string) {
  const db = getRawDb();
  const changed = await db.prepare("UPDATE meals SET status = 'hidden' WHERE id = ? AND status = 'active'").bind(mealId).run();
  if (changed.meta.changes !== 1) throw new GovernanceError("餐次不存在或已经隐藏", 404);
  await audit(adminId, "hide_meal", "meal", mealId, {});
  return { mealId, status: "hidden" };
}

async function verifyName(adminId: string, suggestionId: string, language: string) {
  if (!new Set(["fr", "zh", "other"]).has(language)) throw new GovernanceError("名称语言无效");
  const db = getRawDb();
  const row = await db.prepare("SELECT dish_id,name,normalized_name FROM name_suggestions WHERE id = ? AND status <> 'rejected'").bind(suggestionId).first<{ dish_id: string; name: string; normalized_name: string }>();
  if (!row) throw new GovernanceError("名称候选不存在", 404);
  const canonicalColumn = language === "fr" ? "canonical_name_fr" : language === "zh" ? "canonical_name_zh" : null;
  await db.batch([
    db.prepare("UPDATE name_suggestions SET status = 'verified' WHERE id = ?").bind(suggestionId),
    canonicalColumn
      ? db.prepare(`UPDATE dishes SET ${canonicalColumn} = ?, naming_status = 'verified' WHERE id = ?`).bind(row.name, row.dish_id)
      : db.prepare("UPDATE dishes SET naming_status = 'verified' WHERE id = ?").bind(row.dish_id),
    db.prepare("INSERT INTO dish_aliases (id,dish_id,name,normalized_name,language,source,created_by) VALUES (?,?,?,?,?,'admin',?) ON CONFLICT(dish_id,normalized_name) DO UPDATE SET source='admin',language=excluded.language").bind(crypto.randomUUID(), row.dish_id, row.name, row.normalized_name, language, adminId),
  ]);
  await audit(adminId, "verify_name", "suggestion", suggestionId, { dishId: row.dish_id, language });
  return { suggestionId, status: "verified" };
}

async function mergeDish(adminId: string, sourceId: string, targetId: string) {
  if (!sourceId || !targetId || sourceId === targetId) throw new GovernanceError("合并对象无效");
  const db = getRawDb();
  const rows = await db.prepare("SELECT id,category,canonical_name_fr,canonical_name_zh,original_description,merged_into_dish_id FROM dishes WHERE id IN (?,?)").bind(sourceId, targetId).all<{
    id: string; category: string; canonical_name_fr: string | null; canonical_name_zh: string | null; original_description: string; merged_into_dish_id: string | null;
  }>();
  const source = rows.results.find((row) => row.id === sourceId);
  const target = rows.results.find((row) => row.id === targetId);
  if (!source || !target || source.category !== target.category || source.merged_into_dish_id || target.merged_into_dish_id) throw new GovernanceError("只能合并两个有效且同类别的菜品");
  const conflicts = await db.prepare("SELECT sv.id,sv.user_id,sv.target_tier,sv.created_at,sv.updated_at,tv.id target_id,tv.created_at target_created_at FROM votes sv INNER JOIN votes tv ON tv.user_id=sv.user_id AND tv.dish_id=? WHERE sv.dish_id=?").bind(targetId, sourceId).all<{
    id: string; user_id: string; target_tier: number; created_at: string; updated_at: string; target_id: string; target_created_at: string;
  }>();
  const statements = [
    db.prepare("INSERT OR IGNORE INTO votes (id,dish_id,user_id,target_tier,created_at,updated_at) SELECT id,?,user_id,target_tier,created_at,updated_at FROM votes WHERE dish_id=? ORDER BY created_at ASC").bind(targetId, sourceId),
    db.prepare("DELETE FROM votes WHERE dish_id=?").bind(sourceId),
    db.prepare("UPDATE servings SET dish_id=? WHERE dish_id=?").bind(targetId, sourceId),
    db.prepare("UPDATE dishes SET merged_into_dish_id=? WHERE id=?").bind(targetId, sourceId),
  ];
  for (const conflict of conflicts.results) if (conflict.created_at < conflict.target_created_at) statements.unshift(
    db.prepare("UPDATE votes SET target_tier=?,created_at=?,updated_at=? WHERE id=?").bind(conflict.target_tier, conflict.created_at, conflict.updated_at, conflict.target_id),
  );
  for (const name of [source.canonical_name_fr, source.canonical_name_zh, source.original_description].filter(Boolean) as string[]) statements.push(
    db.prepare("INSERT INTO dish_aliases (id,dish_id,name,normalized_name,source,created_by) VALUES (?,?,?,?,'admin',?) ON CONFLICT(dish_id,normalized_name) DO NOTHING").bind(crypto.randomUUID(), targetId, name, normalizeDishName(name), adminId),
  );
  await db.batch(statements);
  await audit(adminId, "merge_dish", "dish", sourceId, { targetId, conflictingSourceVoteIds: conflicts.results.map((row) => row.id), rule: "earlier_vote_kept" });
  return { sourceId, targetId };
}

async function splitServing(adminId: string, servingId: string, rawName: string) {
  const db = getRawDb();
  const serving = await db.prepare("SELECT s.dish_id,d.category FROM servings s JOIN dishes d ON d.id=s.dish_id WHERE s.id=?").bind(servingId).first<{ dish_id: string; category: string }>();
  if (!serving) throw new GovernanceError("出餐记录不存在", 404);
  const dishId = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO dishes (id,original_description,category,naming_status) VALUES (?,?,?,'unknown')").bind(dishId, rawName.trim().slice(0, 80), serving.category),
    db.prepare("UPDATE servings SET dish_id=? WHERE id=?").bind(dishId, servingId),
  ]);
  await audit(adminId, "split_serving", "serving", servingId, { fromDishId: serving.dish_id, newDishId: dishId });
  return { servingId, dishId };
}

async function audit(adminId: string, action: string, targetType: string, targetId: string, details: object) {
  await getRawDb().prepare("INSERT INTO moderation_actions (id,admin_id,action,target_type,target_id,details_json) VALUES (?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), adminId, action, targetType, targetId, JSON.stringify(details)).run();
}
