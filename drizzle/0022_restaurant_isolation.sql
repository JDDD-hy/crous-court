ALTER TABLE `dishes` ADD `venue_id` text REFERENCES venues(id);--> statement-breakpoint
ALTER TABLE `dishes` ADD `legacy_source_id` text;--> statement-breakpoint
CREATE INDEX `dishes_venue_category_idx` ON `dishes` (`venue_id`,`category`);--> statement-breakpoint
CREATE UNIQUE INDEX `dishes_legacy_venue_unique` ON `dishes` (`legacy_source_id`,`venue_id`);--> statement-breakpoint
CREATE INDEX `meal_items_serving_meal_idx` ON `meal_items` (`serving_id`,`meal_id`);