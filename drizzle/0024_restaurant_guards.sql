-- No data rewrite here. Enforce identity even if a caller bypasses the UI.
CREATE TRIGGER dishes_venue_immutable BEFORE UPDATE OF venue_id ON dishes
WHEN (OLD.venue_id IS NOT NULL AND NEW.venue_id IS NOT OLD.venue_id)
  OR EXISTS (SELECT 1 FROM servings WHERE dish_id=OLD.id AND venue_id IS NOT NEW.venue_id)
BEGIN SELECT RAISE(ABORT, 'dish_venue_mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER servings_venue_insert BEFORE INSERT ON servings
BEGIN
  UPDATE dishes SET venue_id=NEW.venue_id WHERE id=NEW.dish_id AND venue_id IS NULL
    AND merged_into_dish_id IS NULL AND legacy_source_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM servings WHERE dish_id=NEW.dish_id);
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM dishes WHERE id=NEW.dish_id AND venue_id=NEW.venue_id AND merged_into_dish_id IS NULL)
    THEN RAISE(ABORT, 'dish_venue_mismatch') END;
END;
--> statement-breakpoint
CREATE TRIGGER servings_venue_update BEFORE UPDATE OF dish_id,venue_id ON servings
WHEN OLD.venue_id IS NOT NEW.venue_id OR NOT EXISTS(SELECT 1 FROM dishes WHERE id=NEW.dish_id AND venue_id=NEW.venue_id AND merged_into_dish_id IS NULL)
BEGIN SELECT RAISE(ABORT, 'dish_venue_mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER votes_scoped_insert BEFORE INSERT ON votes
WHEN NOT EXISTS(SELECT 1 FROM dishes WHERE id=NEW.dish_id AND venue_id IS NOT NULL AND merged_into_dish_id IS NULL)
BEGIN SELECT RAISE(ABORT, 'dish_venue_mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER votes_scoped_update BEFORE UPDATE OF dish_id ON votes
WHEN NOT EXISTS(SELECT 1 FROM dishes old_d JOIN dishes new_d ON new_d.id=NEW.dish_id
  WHERE old_d.id=OLD.dish_id AND new_d.venue_id IS NOT NULL AND new_d.merged_into_dish_id IS NULL
    AND (old_d.venue_id=new_d.venue_id OR (old_d.venue_id IS NULL AND OLD.source_serving_id IS NOT NULL AND NEW.source_serving_id IS OLD.source_serving_id
      AND EXISTS(SELECT 1 FROM servings WHERE id=NEW.source_serving_id AND dish_id=NEW.dish_id AND venue_id=new_d.venue_id))))
BEGIN SELECT RAISE(ABORT, 'dish_venue_mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER votes_source_immutable BEFORE UPDATE OF source_serving_id ON votes
WHEN NEW.source_serving_id IS NOT OLD.source_serving_id
BEGIN SELECT RAISE(ABORT, 'invalid_vote_source'); END;
--> statement-breakpoint
CREATE TRIGGER dishes_same_venue_merge BEFORE UPDATE OF merged_into_dish_id ON dishes
WHEN NEW.merged_into_dish_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dishes target
  WHERE target.id=NEW.merged_into_dish_id AND target.venue_id=NEW.venue_id AND target.category=NEW.category AND target.merged_into_dish_id IS NULL)
BEGIN SELECT RAISE(ABORT, 'dish_venue_mismatch'); END;
