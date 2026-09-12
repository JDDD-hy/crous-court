import { getRawDb } from "@/db";
import { normalizeDishName } from "./name-utils";

export async function findDishCandidates(query: string, category: "main" | "side") {
  const normalized = normalizeDishName(query);
  const rows = await getRawDb().prepare(`SELECT DISTINCT d.id,
      coalesce(d.canonical_name_fr, d.canonical_name_zh, a.name, nullif(d.original_description,''), '神秘菜品 #' || substr(d.id,-4)) AS name,
      p.id AS photo_id, v.canonical_name AS venue, s.served_on
    FROM dishes d
    LEFT JOIN dish_aliases a ON a.dish_id = d.id
    LEFT JOIN servings s ON s.dish_id = d.id AND s.status = 'active'
    LEFT JOIN meal_items mi ON mi.serving_id = s.id
    LEFT JOIN meals m ON m.id = mi.meal_id AND m.status = 'active'
    LEFT JOIN photos p ON p.meal_id = m.id
    LEFT JOIN venues v ON v.id = s.venue_id
    WHERE d.category = ? AND d.merged_into_dish_id IS NULL AND (
      ? = '' OR instr(lower(coalesce(d.canonical_name_fr,'')), ?) > 0
      OR instr(lower(coalesce(d.canonical_name_zh,'')), ?) > 0
      OR instr(lower(coalesce(d.original_description,'')), ?) > 0
      OR instr(coalesce(a.normalized_name,''), ?) > 0)
    ORDER BY CASE WHEN a.normalized_name = ? THEN 0 ELSE 1 END, s.served_on DESC
    LIMIT 3`).bind(category, normalized, normalized, normalized, normalized, normalized, normalized).all<{
      id: string; name: string; photo_id: string | null; venue: string | null; served_on: string | null;
    }>();
  return rows.results.map((row) => ({ id: row.id, name: row.name, image: row.photo_id ? `/api/photos/${row.photo_id}` : null, venue: row.venue, date: row.served_on }));
}
