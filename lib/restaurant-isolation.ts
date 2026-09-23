export const isolationMigrationId = "restaurant-isolation-v1";
const shared = "3dc63a37-5ad5-47f4-9b2a-b3ea00ca147c";

// This exact historical split is a release gate: do not deploy without owner approval.
// The old dish and its three unattributed votes remain intact as an archive.
export function restaurantIsolationStatements(db: D1Database, runId: string) {
  const gate = `EXISTS(SELECT 1 FROM app_data_migrations WHERE id='${isolationMigrationId}' AND run_id=?)`;
  return [
    db.prepare(`INSERT INTO app_data_migrations(id,run_id)
      SELECT '${isolationMigrationId}',CASE WHEN
        (SELECT COUNT(*) FROM dishes WHERE venue_id IS NULL)<1000
        AND NOT EXISTS(SELECT dish_id FROM servings GROUP BY dish_id HAVING COUNT(DISTINCT venue_id)>1 AND dish_id<>'${shared}')
        AND NOT EXISTS(SELECT 1 FROM servings s JOIN dishes d ON d.id=s.dish_id WHERE d.merged_into_dish_id IS NOT NULL)
        AND (NOT EXISTS(SELECT 1 FROM dishes WHERE id='${shared}') OR (
          EXISTS(SELECT 1 FROM dishes WHERE id='${shared}' AND naming_status='unknown' AND merged_into_dish_id IS NULL AND venue_id IS NULL)
          AND (SELECT COUNT(*) FROM servings WHERE dish_id='${shared}')=2
          AND EXISTS(SELECT 1 FROM servings WHERE id='54af46ba-ff74-45bc-ad0a-717bdeb8128c' AND dish_id='${shared}' AND venue_id='cafeteria-lexperimental-2' AND initial_tier=3)
          AND EXISTS(SELECT 1 FROM servings WHERE id='f2215e9e-b33d-4e3e-bb10-1f49383810f6' AND dish_id='${shared}' AND venue_id='cafeteria-escoffier-2' AND initial_tier=2)
          AND (SELECT COUNT(*) FROM votes WHERE dish_id='${shared}')=3
          AND (SELECT COUNT(*) FROM votes WHERE dish_id='${shared}' AND source_serving_id IS NULL AND (
            (id='104dfe09-8513-49bf-a2de-a628059b5cb6' AND target_tier=3) OR
            (id='1f0e4251-503e-4d29-a640-f09f0eb93b98' AND target_tier=2) OR
            (id='69961d21-1d83-4ac5-b5a9-cf87a73a0099' AND target_tier=3)))=3
        )) THEN ? ELSE NULL END WHERE NOT EXISTS(SELECT 1 FROM app_data_migrations WHERE id='${isolationMigrationId}')
      ON CONFLICT(id) DO NOTHING`).bind(runId),
    db.prepare(`UPDATE dishes SET venue_id=(SELECT MIN(venue_id) FROM servings WHERE dish_id=dishes.id)
      WHERE venue_id IS NULL AND (SELECT COUNT(DISTINCT venue_id) FROM servings WHERE dish_id=dishes.id)=1 AND ${gate}`).bind(runId),
    db.prepare(`INSERT INTO dishes(id,venue_id,legacy_source_id,canonical_name_fr,canonical_name_en,canonical_name_zh,
      machine_name_zh,machine_name_source,machine_name_en,machine_name_en_source,original_description,category,naming_status,created_at)
      SELECT lower(hex(randomblob(16))),s.venue_id,d.id,d.canonical_name_fr,d.canonical_name_en,d.canonical_name_zh,
        d.machine_name_zh,d.machine_name_source,d.machine_name_en,d.machine_name_en_source,d.original_description,d.category,'unknown',d.created_at
      FROM dishes d JOIN servings s ON s.dish_id=d.id WHERE d.id='${shared}' AND ${gate} GROUP BY s.venue_id`).bind(runId),
    db.prepare(`UPDATE dishes SET legacy_source_id=COALESCE(legacy_source_id,id) WHERE venue_id IS NULL AND ${gate}`).bind(runId),
    db.prepare(`UPDATE servings SET dish_id=(SELECT id FROM dishes WHERE legacy_source_id='${shared}' AND venue_id=servings.venue_id)
      WHERE dish_id='${shared}' AND ${gate}`).bind(runId),
    db.prepare(`INSERT INTO votes(id,dish_id,user_id,target_tier,source_serving_id,created_at,updated_at)
      SELECT lower(hex(randomblob(16))),s.dish_id,s.creator_id,s.initial_tier,s.id,s.created_at,s.created_at
      FROM servings s JOIN dishes d ON d.id=s.dish_id WHERE d.legacy_source_id='${shared}' AND ${gate}
      ON CONFLICT(dish_id,user_id) DO NOTHING`).bind(runId),
    // NOT NULL makes a failed invariant roll the entire D1 batch back, including its marker.
    db.prepare(`UPDATE app_data_migrations SET run_id=NULL WHERE id='${isolationMigrationId}' AND run_id=?
      AND EXISTS(SELECT 1 FROM servings s JOIN dishes d ON d.id=s.dish_id WHERE d.venue_id IS NOT s.venue_id)`).bind(runId),
  ];
}
