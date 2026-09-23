import { courtDateRanges } from "./calendar.ts";

export const rankingPageSize = 48;
export function parseRankingPage(value: string | string[] | undefined) {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d{0,4}$/.test(value) || Number(value) > 10000) throw new RangeError("Invalid ranking page");
  return Number(value);
}
export type RankingQuery = { category?: "main" | "side"; venueIds?: string[]; dishId?: string; relatedTo?: string; grouped?: boolean; recent?: boolean; unknown?: boolean; page?: number; limit?: number };

// JSON table parameters keep binding count constant as the directory grows.
export function rankingQuery(input: RankingQuery, now = new Date()) {
  const page = input.page ?? 1;
  const limit = input.limit ?? rankingPageSize;
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 60) throw new RangeError("Invalid ranking page");
  const filters = ["s.status = 'active'", "m.status = 'active'", "d.merged_into_dish_id IS NULL", "d.venue_id = s.venue_id"];
  const bindings: (string | number)[] = [];
  if (input.venueIds !== undefined) { filters.push("s.venue_id IN (SELECT value FROM json_each(?))"); bindings.push(JSON.stringify(input.venueIds)); }
  if (input.category) { filters.push("d.category = ?"); bindings.push(input.category); }
  if (input.dishId) { filters.push("d.id = ?"); bindings.push(input.dishId); }
  // Only explicit shared provenance links restaurant identities; names are not a grouping key.
  if (input.relatedTo) {
    filters.push("(COALESCE(d.legacy_source_id,d.id),d.category) = (SELECT COALESCE(legacy_source_id,id),category FROM dishes WHERE id=? AND merged_into_dish_id IS NULL)");
    bindings.push(input.relatedTo);
  }
  if (input.unknown) filters.push("d.naming_status IN ('unknown','suggested')");
  if (input.recent) {
    filters.push("EXISTS (SELECT 1 FROM json_each(?) dates WHERE json_extract(dates.value, '$.zone') = v.timezone AND s.served_on BETWEEN json_extract(dates.value, '$.yesterday') AND json_extract(dates.value, '$.today'))");
    bindings.push(JSON.stringify(courtDateRanges(now)));
  }
  const order = `${input.recent ? "served_on DESC," : ""} sort_tier, vote_count DESC, id`;
  return { sql: `WITH sightings AS (
    SELECT s.dish_id, s.id serving_id, s.served_on, s.initial_tier,
      v.id venue_id, v.canonical_name venue_name, v.nickname venue_nickname, v.address venue_address, v.timezone,
      m.id meal_id, ROW_NUMBER() OVER (PARTITION BY s.dish_id ORDER BY s.served_on DESC, s.created_at DESC, s.id) rn
    FROM servings s JOIN dishes d ON d.id = s.dish_id
    JOIN venues v ON v.id = s.venue_id JOIN meal_items mi ON mi.serving_id = s.id JOIN meals m ON m.id = mi.meal_id
    WHERE ${filters.join(" AND ")}
  ), candidates AS (SELECT * FROM sightings WHERE rn = 1), totals AS (
    SELECT votes.dish_id, COUNT(*) vote_count,
      SUM(target_tier = 1) n1, SUM(target_tier = 2) n2, SUM(target_tier = 3) n3, SUM(target_tier = 4) n4, SUM(target_tier = 5) n5
    FROM votes WHERE votes.dish_id IN (SELECT dish_id FROM candidates) GROUP BY votes.dish_id
  ), ranked AS (
    SELECT d.*, c.served_on, c.initial_tier, c.venue_id, c.venue_name, c.venue_nickname, c.venue_address, c.timezone, c.meal_id,
      COALESCE(t.vote_count, 0) vote_count, COALESCE(n1, 0) n1, COALESCE(n2, 0) n2, COALESCE(n3, 0) n3, COALESCE(n4, 0) n4, COALESCE(n5, 0) n5,
      CASE WHEN t.vote_count IS NULL THEN 6 WHEN n1 > t.vote_count / 2 THEN 1 WHEN n1+n2 > t.vote_count / 2 THEN 2
      WHEN n1+n2+n3 > t.vote_count / 2 THEN 3 WHEN n1+n2+n3+n4 > t.vote_count / 2 THEN 4 ELSE 5 END sort_tier
    FROM candidates c JOIN dishes d ON d.id = c.dish_id LEFT JOIN totals t ON t.dish_id = d.id
  )${input.grouped ? `, grouped AS (
    SELECT *, COUNT(*) OVER (PARTITION BY COALESCE(legacy_source_id,id),category) group_size,
      ROW_NUMBER() OVER (PARTITION BY COALESCE(legacy_source_id,id),category ORDER BY ${order}) group_rank FROM ranked
  )` : ""} SELECT *, COALESCE(legacy_source_id,id) group_id, ${input.grouped ? "" : "1 group_size,"} COUNT(*) OVER () total_count,
    (SELECT id FROM photos WHERE meal_id = listing.meal_id ORDER BY id LIMIT 1) photo_id,
    (SELECT name FROM dish_aliases WHERE dish_id = listing.id ORDER BY name LIMIT 1) alias_name
    FROM ${input.grouped ? "grouped" : "ranked"} listing ${input.grouped ? "WHERE group_rank=1" : ""} ORDER BY ${order} LIMIT ? OFFSET ?`,
  bindings: [...bindings, limit, (page - 1) * limit] };
}
