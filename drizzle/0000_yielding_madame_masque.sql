CREATE TABLE `dishes` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_name_fr` text,
	`canonical_name_zh` text,
	`original_description` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`naming_status` text DEFAULT 'unknown' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "dishes_category_check" CHECK("dishes"."category" in ('main', 'side')),
	CONSTRAINT "dishes_naming_status_check" CHECK("dishes"."naming_status" in ('unknown', 'suggested', 'community', 'verified'))
);
--> statement-breakpoint
CREATE INDEX `dishes_category_idx` ON `dishes` (`category`);--> statement-breakpoint
CREATE TABLE `meal_items` (
	`meal_id` text NOT NULL,
	`serving_id` text NOT NULL,
	`slot` text NOT NULL,
	PRIMARY KEY(`meal_id`, `slot`),
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`serving_id`) REFERENCES `servings`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "meal_items_slot_check" CHECK("meal_items"."slot" in ('main', 'side_1', 'side_2'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meal_items_meal_serving_unique` ON `meal_items` (`meal_id`,`serving_id`);--> statement-breakpoint
CREATE TABLE `meals` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`creator_id` text NOT NULL,
	`eaten_on` text NOT NULL,
	`overall_note` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "meals_status_check" CHECK("meals"."status" in ('active', 'hidden'))
);
--> statement-breakpoint
CREATE INDEX `meals_venue_date_idx` ON `meals` (`venue_id`,`eaten_on`);--> statement-breakpoint
CREATE TABLE `servings` (
	`id` text PRIMARY KEY NOT NULL,
	`dish_id` text NOT NULL,
	`venue_id` text NOT NULL,
	`served_on` text NOT NULL,
	`creator_id` text NOT NULL,
	`initial_tier` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "servings_initial_tier_check" CHECK("servings"."initial_tier" between 1 and 5),
	CONSTRAINT "servings_status_check" CHECK("servings"."status" in ('active', 'hidden'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `servings_dish_venue_date_unique` ON `servings` (`dish_id`,`venue_id`,`served_on`);--> statement-breakpoint
CREATE INDEX `servings_venue_date_idx` ON `servings` (`venue_id`,`served_on`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_name` text NOT NULL,
	`nickname` text NOT NULL,
	`address` text,
	`latitude` integer,
	`longitude` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "venues_active_check" CHECK("venues"."active" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venues_canonical_name_unique` ON `venues` (`canonical_name`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` text PRIMARY KEY NOT NULL,
	`dish_id` text NOT NULL,
	`user_id` text NOT NULL,
	`target_tier` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "votes_target_tier_check" CHECK("votes"."target_tier" between 1 and 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `votes_dish_user_unique` ON `votes` (`dish_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `votes_dish_tier_idx` ON `votes` (`dish_id`,`target_tier`);
--> statement-breakpoint
INSERT INTO `venues` (`id`, `canonical_name`, `nickname`, `active`) VALUES
  ('venue-escoffier', 'Escoffier', '学校 CROUS / Télécom 附近', 1),
  ('venue-experimental', 'L’Expérimental', '宿舍 CROUS / All Suites 附近', 1)
ON CONFLICT(`id`) DO UPDATE SET
  `canonical_name` = excluded.`canonical_name`,
  `nickname` = excluded.`nickname`,
  `active` = excluded.`active`;
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
