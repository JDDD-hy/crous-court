ALTER TABLE `votes` ADD `source_serving_id` text REFERENCES servings(id);--> statement-breakpoint
CREATE TRIGGER votes_active_dish_insert BEFORE INSERT ON votes
WHEN EXISTS(SELECT 1 FROM dishes WHERE id=NEW.dish_id AND merged_into_dish_id IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'dish_no_longer_active'); END;
--> statement-breakpoint
CREATE TRIGGER votes_active_dish_update BEFORE UPDATE OF dish_id ON votes
WHEN EXISTS(SELECT 1 FROM dishes WHERE id=NEW.dish_id AND merged_into_dish_id IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'dish_no_longer_active'); END;
--> statement-breakpoint
CREATE TRIGGER servings_active_dish_insert BEFORE INSERT ON servings
WHEN EXISTS(SELECT 1 FROM dishes WHERE id=NEW.dish_id AND merged_into_dish_id IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'dish_no_longer_active'); END;
--> statement-breakpoint
CREATE TRIGGER servings_active_dish_update BEFORE UPDATE OF dish_id ON servings
WHEN EXISTS(SELECT 1 FROM dishes WHERE id=NEW.dish_id AND merged_into_dish_id IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'dish_no_longer_active'); END;
--> statement-breakpoint
CREATE TRIGGER votes_source_insert BEFORE INSERT ON votes
WHEN NEW.source_serving_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM servings s WHERE s.id=NEW.source_serving_id AND s.dish_id=NEW.dish_id AND s.creator_id=NEW.user_id AND s.initial_tier=NEW.target_tier)
BEGIN SELECT RAISE(ABORT, 'invalid_vote_source'); END;
--> statement-breakpoint
CREATE TRIGGER votes_source_update BEFORE UPDATE OF dish_id,user_id,target_tier,source_serving_id ON votes
WHEN NEW.source_serving_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM servings s WHERE s.id=NEW.source_serving_id AND s.dish_id=NEW.dish_id AND s.creator_id=NEW.user_id AND s.initial_tier=NEW.target_tier)
BEGIN SELECT RAISE(ABORT, 'invalid_vote_source'); END;
