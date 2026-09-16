CREATE TABLE `__new_meal_items` (
	`meal_id` text NOT NULL,
	`serving_id` text NOT NULL,
	`slot` text NOT NULL,
	PRIMARY KEY(`meal_id`, `slot`),
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`serving_id`) REFERENCES `servings`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "meal_items_slot_check" CHECK("__new_meal_items"."slot" in ('main', 'side_1', 'side_2', 'side_3', 'side_4', 'side_5', 'side_6', 'side_7', 'side_8'))
);
--> statement-breakpoint
INSERT INTO `__new_meal_items`("meal_id", "serving_id", "slot") SELECT "meal_id", "serving_id", "slot" FROM `meal_items`;--> statement-breakpoint
DROP TABLE `meal_items`;--> statement-breakpoint
ALTER TABLE `__new_meal_items` RENAME TO `meal_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `meal_items_meal_serving_unique` ON `meal_items` (`meal_id`,`serving_id`);
--> statement-breakpoint
CREATE TRIGGER `meal_items_validate_insert`
BEFORE INSERT ON `meal_items`
WHEN EXISTS (
  SELECT 1 FROM `servings` s JOIN `dishes` d ON d.id = s.dish_id
  WHERE s.id = NEW.serving_id
    AND ((NEW.slot = 'main' AND d.category <> 'main') OR (NEW.slot <> 'main' AND d.category <> 'side'))
)
BEGIN
  SELECT RAISE(ABORT, 'meal item slot does not match dish category');
END;
--> statement-breakpoint
CREATE TRIGGER `meal_items_validate_update`
BEFORE UPDATE ON `meal_items`
WHEN EXISTS (
  SELECT 1 FROM `servings` s JOIN `dishes` d ON d.id = s.dish_id
  WHERE s.id = NEW.serving_id
    AND ((NEW.slot = 'main' AND d.category <> 'main') OR (NEW.slot <> 'main' AND d.category <> 'side'))
)
BEGIN
  SELECT RAISE(ABORT, 'meal item slot does not match dish category');
END;
--> statement-breakpoint
CREATE TRIGGER `meal_items_validate_insert_meal_match`
BEFORE INSERT ON `meal_items`
WHEN EXISTS (
  SELECT 1 FROM `meals` m JOIN `servings` s ON s.id = NEW.serving_id
  WHERE m.id = NEW.meal_id AND (m.venue_id <> s.venue_id OR m.eaten_on <> s.served_on)
)
BEGIN
  SELECT RAISE(ABORT, 'meal and serving venue/date do not match');
END;
--> statement-breakpoint
CREATE TRIGGER `meal_items_validate_update_meal_match`
BEFORE UPDATE ON `meal_items`
WHEN EXISTS (
  SELECT 1 FROM `meals` m JOIN `servings` s ON s.id = NEW.serving_id
  WHERE m.id = NEW.meal_id AND (m.venue_id <> s.venue_id OR m.eaten_on <> s.served_on)
)
BEGIN
  SELECT RAISE(ABORT, 'meal and serving venue/date do not match');
END;
