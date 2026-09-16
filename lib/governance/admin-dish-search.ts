import { getRawDb } from "@/db";
import { GovernanceError } from "./errors";

export type AdminDish = {
  id: string; original_description: string; canonical_name_zh: string | null;
  canonical_name_en: string | null; canonical_name_fr: string | null;
  category: "main" | "side"; merged_into_dish_id: string | null;
  votes: number; servings: number; visible: number;
};

export async function searchAdminDishes(query: string, offset: number) {
  if (query.length > 160 || !Number.isSafeInteger(offset) || offset < 0) {
    throw new GovernanceError("查询条件无效", 400);
  }
  const q = query.trim().toLowerCase();
  // Literal substring search, as in dish candidates; % and _ are not wildcards.
  const rows = await getRawDb().prepare(`SELECT d.id,d.original_description,d.canonical_name_zh,
    d.canonical_name_en,d.canonical_name_fr,d.category,d.merged_into_dish_id,
    (SELECT count(*) FROM votes v WHERE v.dish_id=d.id) votes,
    (SELECT count(*) FROM servings s WHERE s.dish_id=d.id) servings,
    EXISTS(SELECT 1 FROM servings s JOIN meal_items mi ON mi.serving_id=s.id JOIN meals m ON m.id=mi.meal_id
      WHERE s.dish_id=d.id AND s.status='active' AND m.status='active') visible
    FROM dishes d WHERE ?='' OR instr(lower(d.id),?)>0
    OR instr(lower(coalesce(d.original_description,'')),?)>0
    OR instr(lower(coalesce(d.canonical_name_zh,'')),?)>0
    OR instr(lower(coalesce(d.canonical_name_en,'')),?)>0
    OR instr(lower(coalesce(d.canonical_name_fr,'')),?)>0
    OR EXISTS(SELECT 1 FROM dish_aliases a WHERE a.dish_id=d.id AND instr(lower(a.name),?)>0)
    OR EXISTS(SELECT 1 FROM servings s WHERE s.dish_id=d.id AND instr(lower(coalesce(s.original_description,'')),?)>0)
    OR (d.machine_name_source=coalesce(nullif(d.canonical_name_en,''),d.original_description) AND instr(coalesce(d.machine_name_zh,''),?)>0)
    OR (d.machine_name_en_source=coalesce(nullif(d.canonical_name_zh,''),d.original_description) AND instr(lower(coalesce(d.machine_name_en,'')),?)>0)
    ORDER BY d.created_at DESC,d.id LIMIT 26 OFFSET ?`)
    .bind(q,q,q,q,q,q,q,q,q,q,offset).all<AdminDish>();
  return { items: rows.results.slice(0,25), nextOffset: rows.results.length > 25 ? offset + 25 : null };
}
