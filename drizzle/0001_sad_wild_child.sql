CREATE TABLE `daily_case_counters` (
	`eaten_on` text NOT NULL,
	`venue_id` text NOT NULL,
	`next_sequence` integer NOT NULL,
	PRIMARY KEY(`eaten_on`, `venue_id`),
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "daily_case_counters_sequence_check" CHECK("daily_case_counters"."next_sequence" > 0)
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_id` text NOT NULL,
	`creator_id` text NOT NULL,
	`canonical_key` text NOT NULL,
	`thumbnail_key` text NOT NULL,
	`media_type` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`byte_size` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "photos_media_type_check" CHECK("photos"."media_type" in ('image/jpeg', 'image/png')),
	CONSTRAINT "photos_dimensions_check" CHECK("photos"."width" > 0 and "photos"."height" > 0),
	CONSTRAINT "photos_byte_size_check" CHECK("photos"."byte_size" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_canonical_key_unique` ON `photos` (`canonical_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `photos_thumbnail_key_unique` ON `photos` (`thumbnail_key`);--> statement-breakpoint
ALTER TABLE `venues` ADD `display_number` integer NOT NULL DEFAULT -1;--> statement-breakpoint
UPDATE `venues` SET `display_number` = CASE `id`
  WHEN 'venue-escoffier' THEN 0
  WHEN 'venue-experimental' THEN 1
  ELSE `rowid` + 1
END;--> statement-breakpoint
CREATE UNIQUE INDEX `venues_display_number_unique` ON `venues` (`display_number`);--> statement-breakpoint
ALTER TABLE `meals` ADD `case_number` text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `meals` ADD `display_order` integer NOT NULL DEFAULT 0;--> statement-breakpoint
UPDATE `meals` SET
  `display_order` = (
    SELECT COUNT(*) FROM `meals` AS earlier
    WHERE earlier.`venue_id` = `meals`.`venue_id`
      AND earlier.`eaten_on` = `meals`.`eaten_on`
      AND (earlier.`created_at` < `meals`.`created_at`
        OR (earlier.`created_at` = `meals`.`created_at` AND earlier.`id` <= `meals`.`id`))
  ),
  `case_number` = replace(`eaten_on`, '-', '') || '-' ||
    (SELECT `display_number` FROM `venues` WHERE `id` = `meals`.`venue_id`) || '-' ||
    printf('%03d', (
      SELECT COUNT(*) FROM `meals` AS earlier
      WHERE earlier.`venue_id` = `meals`.`venue_id`
        AND earlier.`eaten_on` = `meals`.`eaten_on`
        AND (earlier.`created_at` < `meals`.`created_at`
          OR (earlier.`created_at` = `meals`.`created_at` AND earlier.`id` <= `meals`.`id`))
    ));--> statement-breakpoint
CREATE UNIQUE INDEX `meals_case_number_unique` ON `meals` (`case_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `meals_venue_date_order_unique` ON `meals` (`venue_id`,`eaten_on`,`display_order`);
