-- Only used by the isolated local style-validation-db.
UPDATE dishes SET legacy_source_id='preview-couscous', canonical_name_zh='裹粉鱼排配薯角和绿色蔬菜', canonical_name_en='Breaded fish with potato wedges and green vegetables' WHERE id='couscous-boulettes';
UPDATE dishes SET legacy_source_id='preview-lentilles', canonical_name_zh='小扁豆配香肠与时令绿色蔬菜', canonical_name_en='Lentils with sausage and seasonal green vegetables' WHERE id='lentilles-saucisse';
INSERT OR IGNORE INTO dishes(id,venue_id,legacy_source_id,canonical_name_zh,canonical_name_en,original_description,category,naming_status) VALUES
('preview-couscous-other','venue-experimental','preview-couscous','裹粉鱼排配薯角和绿色蔬菜','Breaded fish with potato wedges and green vegetables','local preview','main','community'),
('preview-lentilles-other','venue-escoffier','preview-lentilles','小扁豆配香肠与时令绿色蔬菜','Lentils with sausage and seasonal green vegetables','local preview','main','community');
INSERT OR IGNORE INTO servings(id,dish_id,venue_id,served_on,creator_id,initial_tier) VALUES
('preview-serving-c','preview-couscous-other','venue-experimental','2026-09-09','fixture-user-02',3),
('preview-serving-l','preview-lentilles-other','venue-escoffier','2026-09-10','fixture-user-01',5);
UPDATE servings SET served_on='2026-09-09' WHERE id='preview-serving-c';
UPDATE servings SET served_on='2026-09-10' WHERE id='preview-serving-l';
INSERT OR IGNORE INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) VALUES
('preview-meal-c','venue-experimental','fixture-user-02','2026-09-09','PREVIEW-C',2),
('preview-meal-l','venue-escoffier','fixture-user-01','2026-09-10','PREVIEW-L',2);
INSERT OR IGNORE INTO meal_items(meal_id,serving_id,slot) VALUES ('preview-meal-c','preview-serving-c','main'),('preview-meal-l','preview-serving-l','main');
INSERT OR IGNORE INTO votes(id,dish_id,user_id,target_tier) VALUES ('preview-vote-c','preview-couscous-other','fixture-user-02',3),('preview-vote-l','preview-lentilles-other','fixture-user-01',5);
