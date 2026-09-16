import { getLocale, getT } from "@/lib/i18n/server";
import { getRawDb } from "@/db";
import { GovernanceError } from "./errors";

const gate = "EXISTS(SELECT 1 FROM moderation_actions WHERE id=?)";

function initialVote(servingId: string, auditId: string) {
  return getRawDb().prepare(`INSERT INTO votes (id,dish_id,user_id,target_tier,source_serving_id,created_at,updated_at)
    SELECT ?,dish_id,creator_id,initial_tier,id,created_at,created_at FROM servings WHERE id=? AND ${gate}
    ON CONFLICT(dish_id,user_id) DO NOTHING`).bind(crypto.randomUUID(), servingId, auditId);
}

export async function splitServing(adminId: string, servingId: string, rawName: string) {
  if (!servingId || !rawName.trim() || rawName.trim().length > 80) throw new GovernanceError("请填写行踪 ID 和不超过 80 字的新菜名");
  const db = getRawDb();
  const serving = await db.prepare("SELECT dish_id,creator_id FROM servings WHERE id=?").bind(servingId).first<{ dish_id: string; creator_id: string }>();
  if (!serving) throw new GovernanceError("出餐记录不存在", 404);
  const dishId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const results = await db.batch([
    db.prepare(`INSERT INTO moderation_actions(id,admin_id,action,target_type,target_id,details_json)
      SELECT ?,?,'split_serving','serving',?,? WHERE EXISTS(
        SELECT 1 FROM servings s JOIN dishes d ON d.id=s.dish_id JOIN meal_items mi ON mi.serving_id=s.id JOIN meals m ON m.id=mi.meal_id
        WHERE s.id=? AND s.dish_id=? AND s.status='active' AND m.status='active' AND d.merged_into_dish_id IS NULL)
      AND (SELECT count(*) FROM servings WHERE dish_id=? AND id<>?)>0`)
      .bind(auditId, adminId, servingId, JSON.stringify({ fromDishId: serving.dish_id, newDishId: dishId, rule: "linked_vote_moves_or_initial_restored;unattributed_votes_stay" }), servingId, serving.dish_id, serving.dish_id, servingId),
    db.prepare(`INSERT INTO dishes(id,original_description,category,naming_status)
      SELECT ?,?,category,'unknown' FROM dishes WHERE id=? AND ${gate}`).bind(dishId, rawName.trim(), serving.dish_id, auditId),
    db.prepare(`UPDATE servings SET dish_id=? WHERE id=? AND ${gate}`).bind(dishId, servingId, auditId),
    db.prepare(`UPDATE votes SET dish_id=? WHERE source_serving_id=? AND ${gate}`).bind(dishId, servingId, auditId),
    initialVote(servingId, auditId),
    // If this author's surviving observations lost their counted initial vote, use the earliest remaining observation.
    db.prepare(`INSERT INTO votes(id,dish_id,user_id,target_tier,source_serving_id,created_at,updated_at)
      SELECT ?,s.dish_id,s.creator_id,s.initial_tier,s.id,s.created_at,s.created_at FROM servings s
      JOIN meal_items mi ON mi.serving_id=s.id JOIN meals m ON m.id=mi.meal_id
      WHERE s.dish_id=? AND s.creator_id=? AND s.status='active' AND m.status='active' AND ${gate}
      ORDER BY s.created_at,s.id LIMIT 1 ON CONFLICT(dish_id,user_id) DO NOTHING`).bind(crypto.randomUUID(), serving.dish_id, serving.creator_id, auditId),
  ]);
  if (results[0].meta.changes !== 1) throw new GovernanceError("行踪已变更或已经独立成菜，无需再次拆分，请刷新", 409);
  return { servingId, dishId };
}

export async function getSplitVoteRepairs() {
  const t = await getT();
  const locale = await getLocale();
  return (await getRawDb().prepare(`SELECT DISTINCT s.id serving_id,s.dish_id,s.initial_tier,
    coalesce(CASE WHEN ?='en' THEN d.canonical_name_en ELSE d.canonical_name_zh END,nullif(d.original_description,''),d.canonical_name_fr,d.canonical_name_en,d.canonical_name_zh) name
    FROM servings s JOIN dishes d ON d.id=s.dish_id JOIN moderation_actions a ON a.target_id=s.id
    JOIN meal_items mi ON mi.serving_id=s.id JOIN meals m ON m.id=mi.meal_id
    WHERE a.action='split_serving' AND json_extract(a.details_json,'$.newDishId')=s.dish_id
    AND s.status='active' AND m.status='active' AND d.merged_into_dish_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM votes v WHERE v.dish_id=s.dish_id AND v.user_id=s.creator_id)
    ORDER BY s.created_at LIMIT 30`).bind(locale).all<{ serving_id: string; dish_id: string; initial_tier: number; name: string | null }>()).results.map(row => ({ ...row, name: row.name ?? t("未知菜品") }));
}

export async function repairSplitVote(adminId: string, servingId: string) {
  const auditId = crypto.randomUUID();
  const result = await getRawDb().batch([
    getRawDb().prepare(`INSERT INTO moderation_actions(id,admin_id,action,target_type,target_id,details_json)
      SELECT ?,?,'repair_split_vote','serving',s.id,json_object('dishId',s.dish_id,'initialTier',s.initial_tier,'rule','restore_recorded_initial_only')
      FROM servings s JOIN dishes d ON d.id=s.dish_id JOIN meal_items mi ON mi.serving_id=s.id JOIN meals m ON m.id=mi.meal_id
      WHERE s.id=? AND s.status='active' AND m.status='active' AND d.merged_into_dish_id IS NULL
      AND EXISTS(SELECT 1 FROM moderation_actions a WHERE a.action='split_serving' AND a.target_id=s.id AND json_extract(a.details_json,'$.newDishId')=s.dish_id)
      AND NOT EXISTS(SELECT 1 FROM votes v WHERE v.dish_id=s.dish_id AND v.user_id=s.creator_id)`)
      .bind(auditId, adminId, servingId),
    initialVote(servingId, auditId),
  ]);
  if (result[0].meta.changes !== 1) throw new GovernanceError("初评已存在或行踪已变更，请刷新", 409);
  return { servingId };
}
