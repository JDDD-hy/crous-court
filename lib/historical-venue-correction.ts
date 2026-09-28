export const venueCorrectionId = "owner-ru-correction-20260928";
export const restoredDishId = "3dc63a37-5ad5-47f4-9b2a-b3ea00ca147c";
export const archivedDishIds = ["c96d8770c6fbabc39adb9f115c50746a", "d04d80b0e28bb1a38f02c909db69bd64"];
export const historicalMealMoves = [
  ["015e8c34-8fea-414d-8fd7-6f8ba278f5a8", "cafeteria-lexperimental-2", "ru-lexperimental-2"],
  ["0b1e3613-1a54-463c-b2f0-3f9bb210520f", "cafeteria-escoffier-2", "ru-escoffier-2"],
  ["2625c368-684d-4e22-b169-2f851eef34f7", "cafeteria-lexperimental-2", "ru-lexperimental-2"],
  ["2cf3723a-8421-40a6-988b-116caace6ead", "cafeteria-escoffier-2", "ru-escoffier-2"],
  ["d360514d-33bb-4ba7-bf92-1d79979deff0", "cafeteria-escoffier-2", "ru-escoffier-2"],
  ["d76c2803-a864-4296-9770-594137f0b495", "cafeteria-escoffier-2", "ru-escoffier-2"],
  ["e20c8757-7f01-478f-b681-d5e7b6961521", "cafeteria-escoffier-2", "ru-escoffier-2"],
  ["f10444d2-636f-4103-a344-454480af4107", "cafeteria-escoffier-2", "ru-escoffier-2"],
  ["f50830e3-e815-481f-9413-c7badfd3990e", "cafeteria-escoffier-2", "ru-lexperimental-2"],
] as const;
const guards = ["dishes_venue_immutable", "servings_venue_update", "dishes_same_venue_merge"];
const clones = archivedDishIds.map(id => `'${id}'`).join(",");
const family = `'${restoredDishId}',${clones}`;
// All interpolated identifiers/values are fixed owner-approved records, never request input.
const plan = `WITH plan(meal_id,old_venue,new_venue) AS (VALUES ${historicalMealMoves.map(row => `(${row.map(value => `'${value}'`).join(",")})`).join(",")}),
  serving_plan AS (SELECT s.id,s.dish_id,p.new_venue FROM plan p JOIN meal_items mi ON mi.meal_id=p.meal_id JOIN servings s ON s.id=mi.serving_id),
  dish_plan AS (SELECT dish_id,MIN(new_venue) new_venue FROM serving_plan GROUP BY dish_id)`;
const gate = `EXISTS(SELECT 1 FROM app_data_migrations WHERE id='${venueCorrectionId}' AND run_id=?)`;

export async function correctHistoricalVenues(db: D1Database) {
  if (await db.prepare("SELECT id FROM app_data_migrations WHERE id=?").bind(venueCorrectionId).first()) return;
  const definitions = await db.prepare(`SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name IN (${guards.map(name => `'${name}'`).join(",")}) ORDER BY name`).all<{ name: string; sql: string }>();
  if (definitions.results.length !== guards.length || definitions.results.some(row => !row.sql)) throw new Error("Venue correction guards missing");
  // D1 batch is one transaction: other writers never observe the guards temporarily removed.
  await db.batch(venueCorrectionStatements(db, crypto.randomUUID(), definitions.results.map(row => row.sql)));
}

export function venueCorrectionStatements(db: D1Database, runId: string, restoreGuards: string[]) {
  const statement = (sql: string) => db.prepare(sql).bind(runId);
  const assertions = `
    (SELECT count(*) FROM meals m JOIN plan p ON p.meal_id=m.id AND p.old_venue=m.venue_id)=9
    AND (SELECT count(*) FROM serving_plan)=28
    AND NOT EXISTS(SELECT dish_id FROM serving_plan GROUP BY dish_id HAVING count(DISTINCT new_venue)>1)
    AND NOT EXISTS(SELECT 1 FROM servings WHERE dish_id IN (SELECT dish_id FROM dish_plan) AND id NOT IN (SELECT id FROM serving_plan))
    AND NOT EXISTS(SELECT 1 FROM servings s JOIN meal_items mi ON mi.serving_id=s.id JOIN meals m ON m.id=mi.meal_id WHERE s.venue_id IS NOT m.venue_id OR s.served_on<>m.eaten_on)
    AND EXISTS(SELECT 1 FROM dishes WHERE id='${restoredDishId}' AND venue_id IS NULL AND merged_into_dish_id IS NULL AND legacy_source_id=id)
    AND (SELECT count(*) FROM dishes WHERE id IN (${clones}) AND merged_into_dish_id IS NULL AND legacy_source_id='${restoredDishId}')=2
    AND (SELECT count(*) FROM servings WHERE dish_id IN (${clones}))=2
    AND EXISTS(SELECT 1 FROM servings WHERE id='f2215e9e-b33d-4e3e-bb10-1f49383810f6' AND dish_id='${archivedDishIds[0]}' AND initial_tier=2)
    AND EXISTS(SELECT 1 FROM servings WHERE id='54af46ba-ff74-45bc-ad0a-717bdeb8128c' AND dish_id='${archivedDishIds[1]}' AND initial_tier=3)
    AND (SELECT count(*) FROM votes WHERE dish_id='${restoredDishId}')=3
    AND (SELECT count(*) FROM votes WHERE dish_id='${restoredDishId}' AND source_serving_id IS NULL AND (
      (id='104dfe09-8513-49bf-a2de-a628059b5cb6' AND target_tier=3) OR
      (id='1f0e4251-503e-4d29-a640-f09f0eb93b98' AND target_tier=2) OR
      (id='69961d21-1d83-4ac5-b5a9-cf87a73a0099' AND target_tier=3)))=3
    AND (SELECT count(*) FROM votes WHERE dish_id IN (${clones}))=2
    AND (SELECT count(*) FROM votes v JOIN servings s ON s.id=v.source_serving_id
      WHERE v.dish_id IN (${clones}) AND v.user_id=s.creator_id AND v.target_tier=s.initial_tier AND v.dish_id=s.dish_id)=2
    AND NOT EXISTS(SELECT 1 FROM name_suggestions WHERE dish_id IN (${clones}))
    AND NOT EXISTS(SELECT 1 FROM dish_aliases WHERE dish_id IN (${clones}))`;
  return [
    db.prepare(`${plan} INSERT INTO app_data_migrations(id,run_id,details_json)
      SELECT '${venueCorrectionId}',CASE WHEN (${assertions}) OR
        (NOT EXISTS(SELECT 1 FROM meals WHERE id IN (SELECT meal_id FROM plan)) AND NOT EXISTS(SELECT 1 FROM dishes WHERE id IN (${family})))
        THEN ? ELSE NULL END,
      json_object('reason','Owner corrected both venues to RU and approved restoring the original dish and its three votes on 2026-09-28',
        'meals',json((SELECT json_group_array(json_object('id',id,'venueId',venue_id,'displayOrder',display_order,'caseNumber',case_number,'eatenOn',eaten_on)) FROM meals WHERE id IN (SELECT meal_id FROM plan))),
        'servings',json((SELECT json_group_array(json_object('id',id,'dishId',dish_id,'venueId',venue_id)) FROM servings WHERE id IN (SELECT id FROM serving_plan))),
        'dishes',json((SELECT json_group_array(json_object('id',id,'venueId',venue_id,'mergedInto',merged_into_dish_id,'legacySourceId',legacy_source_id)) FROM dishes WHERE id IN (SELECT dish_id FROM dish_plan) OR id='${restoredDishId}')),
        'votes',json((SELECT json_group_array(json_object('id',id,'dishId',dish_id,'userId',user_id,'tier',target_tier,'sourceServingId',source_serving_id,'createdAt',created_at,'updatedAt',updated_at)) FROM votes WHERE dish_id IN (${family}))),
        'counters',json((SELECT json_group_array(json_object('date',eaten_on,'venueId',venue_id,'sequence',next_sequence)) FROM daily_case_counters WHERE venue_id IN ('ru-escoffier-2','ru-lexperimental-2'))))
      WHERE NOT EXISTS(SELECT 1 FROM app_data_migrations WHERE id='${venueCorrectionId}')`).bind(runId),
    ...guards.map(name => db.prepare(`DROP TRIGGER ${name}`)),
    statement(`${plan}, numbered AS MATERIALIZED (
      SELECT m.id,p.new_venue,ROW_NUMBER() OVER(PARTITION BY p.new_venue,m.eaten_on ORDER BY m.created_at,m.id)
        +coalesce((SELECT max(existing.display_order) FROM meals existing WHERE existing.venue_id=p.new_venue AND existing.eaten_on=m.eaten_on AND existing.id NOT IN (SELECT meal_id FROM plan)),0) new_order
      FROM meals m JOIN plan p ON p.meal_id=m.id)
      UPDATE meals SET venue_id=(SELECT new_venue FROM numbered WHERE id=meals.id),display_order=(SELECT new_order FROM numbered WHERE id=meals.id)
      WHERE id IN (SELECT id FROM numbered) AND ${gate}`),
    statement(`${plan} UPDATE dishes SET venue_id=(SELECT new_venue FROM dish_plan WHERE dish_id=dishes.id)
      WHERE id IN (SELECT dish_id FROM dish_plan) AND id NOT IN (${clones}) AND ${gate}`),
    statement(`UPDATE dishes SET venue_id='ru-lexperimental-2' WHERE id='${restoredDishId}' AND ${gate}`),
    statement(`DELETE FROM votes WHERE dish_id IN (${clones}) AND ${gate}`),
    statement(`${plan} UPDATE servings SET venue_id=(SELECT new_venue FROM serving_plan WHERE id=servings.id),
      dish_id=CASE WHEN dish_id IN (${clones}) THEN '${restoredDishId}' ELSE dish_id END
      WHERE id IN (SELECT id FROM serving_plan) AND ${gate}`),
    // Keep the split IDs and their lineage as non-scoring archives, like the earlier historical archives.
    statement(`UPDATE dishes SET venue_id=NULL,merged_into_dish_id='${restoredDishId}' WHERE id IN (${clones}) AND ${gate}`),
    statement(`INSERT INTO daily_case_counters(eaten_on,venue_id,next_sequence)
      SELECT eaten_on,venue_id,max(display_order) FROM meals WHERE venue_id IN ('ru-escoffier-2','ru-lexperimental-2') AND ${gate}
      GROUP BY eaten_on,venue_id ON CONFLICT(eaten_on,venue_id) DO UPDATE SET next_sequence=max(next_sequence,excluded.next_sequence)`),
    statement(`${plan} DELETE FROM dish_history_pages WHERE (dish_id IN (SELECT dish_id FROM dish_plan) OR dish_id IN (${family})) AND ${gate}`),
    ...restoreGuards.map(sql => db.prepare(sql)),
    statement(`UPDATE app_data_migrations SET run_id=NULL WHERE id='${venueCorrectionId}' AND run_id=? AND (
      EXISTS(SELECT 1 FROM servings s JOIN dishes d ON d.id=s.dish_id WHERE s.venue_id IS NOT d.venue_id OR d.merged_into_dish_id IS NOT NULL)
      OR EXISTS(SELECT 1 FROM meal_items mi JOIN meals m ON m.id=mi.meal_id JOIN servings s ON s.id=mi.serving_id WHERE m.venue_id IS NOT s.venue_id OR m.eaten_on<>s.served_on)
      OR EXISTS(SELECT 1 FROM pragma_foreign_key_check))`),
  ];
}
