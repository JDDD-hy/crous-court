-- Local-only Phase 2 fixture. No personal data and no production seed content.
INSERT INTO users (id) VALUES ('fixture-user-01'), ('fixture-user-02'), ('fixture-user-03'), ('fixture-user-04'), ('fixture-user-05')
ON CONFLICT(id) DO NOTHING;

INSERT INTO dishes (id, canonical_name_fr, canonical_name_zh, original_description, category, naming_status) VALUES
  ('couscous-boulettes', 'Couscous aux boulettes', '肉丸古斯古斯', 'Couscous aux boulettes', 'main', 'community'),
  ('lentilles-saucisse', 'Lentilles & saucisse', '扁豆香肠', 'Lentilles & saucisse', 'main', 'community'),
  ('mystery-dessert', NULL, NULL, '巧克力？慕斯？案情复杂', 'side', 'unknown')
ON CONFLICT(id) DO UPDATE SET
  canonical_name_fr = excluded.canonical_name_fr,
  canonical_name_zh = excluded.canonical_name_zh,
  original_description = excluded.original_description,
  category = excluded.category,
  naming_status = excluded.naming_status;

INSERT INTO meals (id, venue_id, creator_id, eaten_on, case_number, display_order, overall_note) VALUES
  ('fixture-meal-01', 'venue-escoffier', 'fixture-user-01', '2026-09-10', '20260910-0-001', 1, 'Phase 2 local fixture'),
  ('fixture-meal-02', 'venue-experimental', 'fixture-user-02', '2026-09-09', '20260909-1-001', 1, 'Phase 2 local fixture'),
  ('fixture-meal-03', 'venue-escoffier', 'fixture-user-03', '2026-09-08', '20260908-0-001', 1, 'Phase 2 local fixture'),
  ('fixture-meal-04', 'venue-escoffier', 'fixture-user-04', '2026-09-03', '20260903-0-001', 1, 'Phase 2 older Serving fixture')
ON CONFLICT(id) DO UPDATE SET venue_id = excluded.venue_id, creator_id = excluded.creator_id, eaten_on = excluded.eaten_on;

INSERT INTO servings (id, dish_id, venue_id, served_on, creator_id, initial_tier) VALUES
  ('fixture-serving-01', 'couscous-boulettes', 'venue-escoffier', '2026-09-10', 'fixture-user-01', 3),
  ('fixture-serving-02', 'lentilles-saucisse', 'venue-experimental', '2026-09-09', 'fixture-user-02', 4),
  ('fixture-serving-03', 'mystery-dessert', 'venue-escoffier', '2026-09-08', 'fixture-user-03', 3),
  ('fixture-serving-04', 'couscous-boulettes', 'venue-escoffier', '2026-09-03', 'fixture-user-04', 4)
ON CONFLICT(id) DO UPDATE SET dish_id = excluded.dish_id, venue_id = excluded.venue_id, served_on = excluded.served_on, initial_tier = excluded.initial_tier;

INSERT INTO meal_items (meal_id, serving_id, slot) VALUES
  ('fixture-meal-01', 'fixture-serving-01', 'main'),
  ('fixture-meal-02', 'fixture-serving-02', 'main'),
  ('fixture-meal-03', 'fixture-serving-03', 'side_1'),
  ('fixture-meal-04', 'fixture-serving-04', 'main')
ON CONFLICT(meal_id, slot) DO UPDATE SET serving_id = excluded.serving_id;

INSERT INTO votes (id, dish_id, user_id, target_tier) VALUES
  ('fixture-vote-c-01', 'couscous-boulettes', 'fixture-user-01', 1),
  ('fixture-vote-c-02', 'couscous-boulettes', 'fixture-user-02', 2),
  ('fixture-vote-c-03', 'couscous-boulettes', 'fixture-user-03', 2),
  ('fixture-vote-c-04', 'couscous-boulettes', 'fixture-user-04', 2),
  ('fixture-vote-c-05', 'couscous-boulettes', 'fixture-user-05', 3),
  ('fixture-vote-l-01', 'lentilles-saucisse', 'fixture-user-01', 3),
  ('fixture-vote-l-02', 'lentilles-saucisse', 'fixture-user-02', 4),
  ('fixture-vote-l-03', 'lentilles-saucisse', 'fixture-user-03', 4),
  ('fixture-vote-m-01', 'mystery-dessert', 'fixture-user-01', 3)
ON CONFLICT(dish_id, user_id) DO UPDATE SET target_tier = excluded.target_tier, updated_at = CURRENT_TIMESTAMP;
