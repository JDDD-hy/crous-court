-- Owner confirmed on 2026-09-15: historical Escoffier and Experimental meals
-- belong to their cafeterias, not the separate RU counters. Keep case numbers.
WITH mapping(old_id,new_id) AS (VALUES
  ('venue-escoffier','cafeteria-escoffier-2'),
  ('venue-experimental','cafeteria-lexperimental-2')
), moved AS MATERIALIZED (
  SELECT m.id, mapping.new_id, m.display_order + coalesce((
    SELECT max(existing.display_order) FROM meals existing
    WHERE existing.venue_id=mapping.new_id AND existing.eaten_on=m.eaten_on
  ),0) AS new_order
  FROM meals m JOIN mapping ON mapping.old_id=m.venue_id
)
UPDATE meals SET venue_id=(SELECT new_id FROM moved WHERE moved.id=meals.id),
  display_order=(SELECT new_order FROM moved WHERE moved.id=meals.id)
WHERE id IN (SELECT id FROM moved);
--> statement-breakpoint
UPDATE servings SET venue_id=CASE venue_id
  WHEN 'venue-escoffier' THEN 'cafeteria-escoffier-2'
  WHEN 'venue-experimental' THEN 'cafeteria-lexperimental-2' END
WHERE venue_id IN ('venue-escoffier','venue-experimental');
--> statement-breakpoint
INSERT INTO daily_case_counters(eaten_on,venue_id,next_sequence)
SELECT eaten_on,venue_id,max(display_order) FROM meals
WHERE venue_id IN ('cafeteria-escoffier-2','cafeteria-lexperimental-2')
GROUP BY eaten_on,venue_id
ON CONFLICT(eaten_on,venue_id) DO UPDATE SET next_sequence=max(daily_case_counters.next_sequence,excluded.next_sequence);
