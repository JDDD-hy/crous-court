import { env } from "cloudflare:workers";
import { getRawDb } from "@/db";
import { translateEnglishNames, translationCandidate } from "./deepl";

export async function translateNewDishNames(dishes: Array<{ id: string; text: string }>) {
  if (!env.DEEPL_API_KEY) return;
  const candidates = dishes.filter(dish => translationCandidate(dish.text));
  if (!candidates.length) return;
  try {
    const translated = await translateEnglishNames(candidates.map(dish => dish.text), env.DEEPL_API_KEY);
    const db = getRawDb();
    const statements = candidates.flatMap((dish, index) => translated[index] === null ? [] : [
      db.prepare("UPDATE dishes SET machine_name_zh=?,machine_name_source=? WHERE id=? AND original_description=? AND canonical_name_zh IS NULL AND merged_into_dish_id IS NULL")
        .bind(translated[index], dish.text, dish.id, dish.text),
    ]);
    if (statements.length) await db.batch(statements);
  } catch (error) {
    // ponytail: one bounded attempt per new dish; add durable retries only if missed translations matter.
    const reason = error instanceof Error && /^Translation unavailable \(\d{3}\)$/.test(error.message) ? error.message : "Translation or storage failure";
    console.warn("Dish translation unavailable; original names retained.", reason);
  }
}
