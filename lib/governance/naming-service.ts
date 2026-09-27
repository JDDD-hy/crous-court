import { getRawDb } from "@/db";
import { normalizeDishName, validDishName } from "./name-utils";
import { enforceGovernanceLimit } from "./rate-limit";
import { GovernanceError } from "./errors";

export { GovernanceError } from "./errors";

const evidenceTypes = new Set(["menu_photo", "ate_today", "visual_guess", "ai_guess"]);
const visibleDish = `SELECT 1 FROM dishes d WHERE d.id=? AND d.merged_into_dish_id IS NULL AND EXISTS (
  SELECT 1 FROM servings s JOIN meal_items mi ON mi.serving_id=s.id JOIN meals m ON m.id=mi.meal_id
  WHERE s.dish_id=d.id AND s.status='active' AND m.status='active')`;

export async function listNameSuggestions(dishId: string) {
  if (!await getRawDb().prepare(visibleDish).bind(dishId).first()) throw new GovernanceError("菜品不存在", 404);
  const rows = await getRawDb().prepare(`SELECT ns.id, ns.name, ns.evidence_type, ns.evidence_note, ns.status,
      count(ne.user_id) AS supporters
    FROM name_suggestions ns LEFT JOIN name_endorsements ne ON ne.suggestion_id = ns.id
    WHERE ns.dish_id = ? AND ns.status <> 'rejected'
    GROUP BY ns.id ORDER BY supporters DESC, ns.created_at ASC`).bind(dishId).all<{
      id: string; name: string; evidence_type: string; evidence_note: string | null; status: string; supporters: number;
    }>();
  return rows.results.map((row) => ({ id: row.id, name: row.name, evidenceType: row.evidence_type, evidenceNote: row.evidence_note, status: row.status, supporters: Number(row.supporters) }));
}

export async function suggestName(dishId: string, userId: string, input: Record<string, unknown>) {
  await enforceGovernanceLimit(userId, "suggest_name", 10);
  const name = validDishName(input.name);
  if (!name) throw new GovernanceError("请输入 1–80 个字符的菜名");
  if (typeof input.evidenceType !== "string" || !evidenceTypes.has(input.evidenceType)) throw new GovernanceError("请选择有效的名称依据");
  const note = typeof input.evidenceNote === "string" ? input.evidenceNote.trim().slice(0, 240) : "";
  const db = getRawDb();
  const dish = await db.prepare(visibleDish).bind(dishId).first();
  if (!dish) throw new GovernanceError("菜品不存在", 404);
  const id = crypto.randomUUID();
  try {
    const [inserted] = await db.batch([
      db.prepare(`INSERT INTO name_suggestions (id,dish_id,proposer_id,name,normalized_name,evidence_type,evidence_note)
        SELECT ?,?,?,?,?,?,? WHERE EXISTS(${visibleDish})`).bind(id, dishId, userId, name, normalizeDishName(name), input.evidenceType, note || null, dishId),
      db.prepare("UPDATE dishes SET naming_status = 'suggested' WHERE id = ? AND naming_status = 'unknown' AND EXISTS(SELECT 1 FROM name_suggestions WHERE id=?)").bind(dishId, id),
    ]);
    if (inserted.meta.changes !== 1) throw new GovernanceError("菜品不存在", 404);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed: name_suggestions.dish_id, name_suggestions.proposer_id, name_suggestions.normalized_name")) throw new GovernanceError("你已经提交过这个名称", 409);
    throw error;
  }
  return { id, name, evidenceType: input.evidenceType, evidenceNote: note || null, status: "pending", supporters: 0 };
}

export async function endorseName(dishId: string, suggestionId: string, userId: string) {
  await enforceGovernanceLimit(userId, "endorse_name", 30);
  const db = getRawDb();
  if (!await db.prepare(visibleDish).bind(dishId).first()) throw new GovernanceError("菜品不存在", 404);
  const suggestion = await db.prepare("SELECT name,normalized_name,proposer_id FROM name_suggestions WHERE id = ? AND dish_id = ? AND status IN ('pending','community')").bind(suggestionId, dishId).first<{ name: string; normalized_name: string; proposer_id: string }>();
  if (!suggestion) throw new GovernanceError("名称候选不存在", 404);
  if (suggestion.proposer_id === userId) throw new GovernanceError("提议者不能支持自己的名称", 409);
  const eligible = `SELECT 1 FROM name_suggestions ns WHERE ns.id=? AND ns.dish_id=?
    AND ns.status IN ('pending','community') AND ns.proposer_id<>? AND EXISTS(${visibleDish})`;
  const eligibility = [suggestionId, dishId, userId, dishId];
  try {
    // A duplicate aborts the batch; every subsequent write also checks current eligibility.
    const results = await db.batch<{ supporters: number; status: string }>([
      db.prepare(`INSERT INTO name_endorsements (suggestion_id,user_id) SELECT ?,? WHERE EXISTS(${eligible})`).bind(suggestionId, userId, ...eligibility),
      db.prepare(`UPDATE name_suggestions SET status='community' WHERE id=? AND EXISTS(${eligible})
        AND (SELECT COUNT(*) FROM name_endorsements WHERE suggestion_id=?)>=3`).bind(suggestionId, ...eligibility, suggestionId),
      db.prepare(`UPDATE dishes SET naming_status='community' WHERE id=? AND naming_status<>'verified'
        AND EXISTS(${eligible}) AND EXISTS(SELECT 1 FROM name_suggestions WHERE id=? AND status='community')`).bind(dishId, ...eligibility, suggestionId),
      db.prepare(`INSERT INTO dish_aliases (id,dish_id,name,normalized_name,source,created_by)
        SELECT ?,dish_id,name,normalized_name,'community',? FROM name_suggestions WHERE id=? AND status='community'
        AND EXISTS(${eligible}) ON CONFLICT(dish_id,normalized_name) DO NOTHING`).bind(crypto.randomUUID(), userId, suggestionId, ...eligibility),
      db.prepare(`SELECT status,(SELECT COUNT(*) FROM name_endorsements WHERE suggestion_id=?) supporters
        FROM name_suggestions WHERE id=?`).bind(suggestionId, suggestionId),
    ]);
    if (results[0].meta.changes !== 1) throw new GovernanceError("名称候选不存在", 404);
    const result = results.at(-1)!.results[0];
    return { supporters: Number(result.supporters), status: result.status };
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed: name_endorsements.suggestion_id, name_endorsements.user_id")) throw new GovernanceError("你已经支持过这个名称", 409);
    throw error;
  }
}
