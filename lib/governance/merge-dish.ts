import { getRawDb } from "@/db";
import { GovernanceError } from "./errors";
import { normalizeDishName } from "./name-utils";

export async function mergeDish(adminId: string, sourceId: string, targetId: string, suggestionId: string | null = null) {
  if (!sourceId || !targetId || sourceId === targetId) throw new GovernanceError("合并对象无效");
  const db = getRawDb();
  const auditId = crypto.randomUUID();
  // The audit insert is the transaction's eligibility gate; every mutation uses its unique ID.
  const gate = "EXISTS(SELECT 1 FROM moderation_actions WHERE id=?)";
  const source = await db.prepare("SELECT canonical_name_fr,canonical_name_zh,original_description FROM dishes WHERE id=?").bind(sourceId).first<Record<string, string | null>>();
  const statements = [
    db.prepare(`INSERT INTO moderation_actions (id,admin_id,action,target_type,target_id,details_json)
      SELECT ?,?,'merge_dish','dish',?,? WHERE EXISTS(
        SELECT 1 FROM dishes s JOIN dishes t ON t.id=? WHERE s.id=? AND s.category=t.category
        AND s.merged_into_dish_id IS NULL AND t.merged_into_dish_id IS NULL)
      AND (? IS NULL OR EXISTS(SELECT 1 FROM ai_merge_suggestions WHERE id=? AND source_id=? AND target_id=? AND status='pending'))`)
      .bind(auditId, adminId, sourceId, JSON.stringify({ targetId, suggestionId, rule: "earlier_vote_kept" }), targetId, sourceId, suggestionId, suggestionId, sourceId, targetId),
    // Remove only conflicting later votes, then move the surviving source votes in place.
    db.prepare(`DELETE FROM votes WHERE dish_id=? AND ${gate} AND EXISTS(
      SELECT 1 FROM votes s WHERE s.dish_id=? AND s.user_id=votes.user_id AND s.created_at<votes.created_at)`)
      .bind(targetId, auditId, sourceId),
    db.prepare(`DELETE FROM votes WHERE dish_id=? AND ${gate} AND EXISTS(
      SELECT 1 FROM votes t WHERE t.dish_id=? AND t.user_id=votes.user_id)`)
      .bind(sourceId, auditId, targetId),
    db.prepare(`UPDATE votes SET dish_id=? WHERE dish_id=? AND ${gate}`).bind(targetId, sourceId, auditId),
    db.prepare(`UPDATE servings SET dish_id=? WHERE dish_id=? AND ${gate}`).bind(targetId, sourceId, auditId),
    db.prepare(`INSERT INTO dish_aliases (id,dish_id,name,normalized_name,language,source,created_by)
      SELECT lower(hex(randomblob(16))),?,name,normalized_name,language,source,created_by FROM dish_aliases
      WHERE dish_id=? AND ${gate} ON CONFLICT(dish_id,normalized_name) DO NOTHING`).bind(targetId, sourceId, auditId),
  ];
  for (const name of Object.values(source ?? {}).filter((value): value is string => Boolean(value))) statements.push(
    db.prepare(`INSERT INTO dish_aliases (id,dish_id,name,normalized_name,source,created_by)
      SELECT ?,?,?,?,'admin',? WHERE ${gate} ON CONFLICT(dish_id,normalized_name) DO NOTHING`)
      .bind(crypto.randomUUID(), targetId, name, normalizeDishName(name), adminId, auditId),
  );
  statements.push(
    db.prepare(`UPDATE dishes SET merged_into_dish_id=? WHERE id=? AND ${gate}`).bind(targetId, sourceId, auditId),
    db.prepare(`UPDATE ai_merge_suggestions SET status='accepted',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP
      WHERE ((source_id=? AND target_id=?) OR (source_id=? AND target_id=?)) AND status='pending' AND ${gate}`)
      .bind(adminId, sourceId, targetId, targetId, sourceId, auditId),
  );
  const result = await db.batch(statements);
  if (result[0].meta.changes !== 1) throw new GovernanceError("菜品或建议已变更，只能合并两个有效且同类别的菜品，请刷新", 409);
  return { sourceId, targetId };
}
