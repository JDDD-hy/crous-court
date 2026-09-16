import { getRawDb } from "@/db";
import { normalizeDishName } from "./name-utils";
import { getLocale, getT } from "@/lib/i18n/server";

export async function findDishCandidates(query: string, category: "main" | "side") {
  const t = await getT();
  const locale = await getLocale();
  const normalized = normalizeDishName(query);
  const rows = await getRawDb().prepare(`WITH candidates AS (SELECT d.id,
      coalesce(CASE WHEN ?='en' THEN d.canonical_name_en ELSE d.canonical_name_zh END,
        CASE WHEN ?='zh' AND d.machine_name_source=coalesce(nullif(d.canonical_name_en,''),d.original_description) THEN d.machine_name_zh || '（机译）' END,
        CASE WHEN ?='en' AND d.machine_name_en_source=coalesce(nullif(d.canonical_name_zh,''),d.original_description) THEN d.machine_name_en || ' (machine translated)' END,
        nullif(d.original_description,''), d.canonical_name_fr, d.canonical_name_en, d.canonical_name_zh, a.name) AS name,
      p.id AS photo_id, v.canonical_name AS venue, s.served_on,
      CASE WHEN a.normalized_name = ? THEN 0 ELSE 1 END AS priority,
      row_number() OVER (PARTITION BY d.id ORDER BY CASE WHEN a.normalized_name = ? THEN 0 ELSE 1 END, s.served_on DESC, s.id, p.id, a.id) AS position
    FROM dishes d
    LEFT JOIN dish_aliases a ON a.dish_id = d.id
    JOIN servings s ON s.dish_id = d.id AND s.status = 'active'
    JOIN meal_items mi ON mi.serving_id = s.id
    JOIN meals m ON m.id = mi.meal_id AND m.status = 'active'
    LEFT JOIN photos p ON p.meal_id = m.id
    LEFT JOIN venues v ON v.id = s.venue_id
    WHERE d.category = ? AND d.merged_into_dish_id IS NULL AND (
      ? = '' OR instr(lower(coalesce(d.canonical_name_fr,'')), ?) > 0
      OR instr(lower(coalesce(d.canonical_name_en,'')), ?) > 0
      OR instr(lower(coalesce(d.canonical_name_zh,'')), ?) > 0
      OR instr(lower(coalesce(d.original_description,'')), ?) > 0
      OR (d.machine_name_source=coalesce(nullif(d.canonical_name_en,''),d.original_description) AND instr(coalesce(d.machine_name_zh,''), ?) > 0)
      OR (d.machine_name_en_source=coalesce(nullif(d.canonical_name_zh,''),d.original_description) AND instr(lower(coalesce(d.machine_name_en,'')), ?) > 0)
      OR instr(coalesce(a.normalized_name,''), ?) > 0))
    SELECT id,name,photo_id,venue,served_on FROM candidates WHERE position = 1
    ORDER BY priority, served_on DESC, id
    LIMIT 3`).bind(locale, locale, locale, normalized, normalized, category, normalized, normalized, normalized, normalized, normalized, normalized, normalized, normalized).all<{
      id: string; name: string | null; photo_id: string | null; venue: string | null; served_on: string | null;
    }>();
  return rows.results.map((row) => ({ id: row.id, name: row.name ?? t("神秘菜品 #{0}", row.id.slice(-4)), image: row.photo_id ? `/api/photos/${row.photo_id}` : null, venue: row.venue, date: row.served_on }));
}
