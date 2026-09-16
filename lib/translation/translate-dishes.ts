import { env } from "cloudflare:workers";
import { getRawDb } from "@/db";
import { translateChineseNames, translateEnglishNames, chineseTranslationCandidate, translationCandidate } from "./deepl";

export async function translateDishNames(dishes: Array<{ id: string }>) {
  if (!env.DEEPL_API_KEY || !dishes.length || dishes.length > 9) return;
  try {
    const db = getRawDb();
    const rows = await db.prepare(`SELECT id,original_description,canonical_name_en,canonical_name_zh FROM dishes WHERE id IN (${dishes.map(() => "?").join(",")}) AND merged_into_dish_id IS NULL`)
      .bind(...dishes.map(dish => dish.id)).all<{ id: string; original_description: string; canonical_name_en: string | null; canonical_name_zh: string | null }>();
    const results = await Promise.allSettled(["en", "zh"].map(async target => {
      const en = target === "en";
      const candidate = en ? chineseTranslationCandidate : translationCandidate;
      const selected = rows.results.filter(row => !(en ? row.canonical_name_en : row.canonical_name_zh))
        .map(row => ({ id: row.id, text: (en ? row.canonical_name_zh : row.canonical_name_en) || row.original_description })).filter(row => candidate(row.text));
      if (!selected.length) return;
      const translated = await (en ? translateChineseNames : translateEnglishNames)(selected.map(row => row.text), env.DEEPL_API_KEY!);
      const source = en ? "coalesce(nullif(canonical_name_zh,''),original_description)" : "coalesce(nullif(canonical_name_en,''),original_description)";
      const sourceColumn = en ? "machine_name_en_source" : "machine_name_source";
      const statements = selected.flatMap((row, index) => translated[index] === null ? [] : [
        db.prepare(`UPDATE dishes SET machine_name_${target}=?,${sourceColumn}=? WHERE id=? AND ${source}=? AND canonical_name_${target} IS NULL AND merged_into_dish_id IS NULL`)
          .bind(translated[index], row.text, row.id, row.text),
      ]);
      if (statements.length) await db.batch(statements);
    }));
    if (results.some(result => result.status === "rejected")) console.warn("Dish translation unavailable; original names retained.");
  } catch {
    // ponytail: bounded attempts on publication/name confirmation; no automatic retry queue.
    console.warn("Dish translation unavailable; original names retained.");
  }
}
