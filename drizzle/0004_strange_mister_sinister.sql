CREATE TABLE `ai_identifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`image_sha256` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_identifications_user_image_model_unique` ON `ai_identifications` (`user_id`,`image_sha256`,`model`,`prompt_version`);--> statement-breakpoint
CREATE INDEX `ai_identifications_user_created_idx` ON `ai_identifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dish_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`dish_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`language` text DEFAULT 'other' NOT NULL,
	`source` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dish_aliases_dish_normalized_unique` ON `dish_aliases` (`dish_id`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `dish_aliases_normalized_idx` ON `dish_aliases` (`normalized_name`);--> statement-breakpoint
CREATE TABLE `moderation_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `moderation_actions_target_idx` ON `moderation_actions` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `name_endorsements` (
	`suggestion_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`suggestion_id`, `user_id`),
	FOREIGN KEY (`suggestion_id`) REFERENCES `name_suggestions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `name_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`dish_id` text NOT NULL,
	`proposer_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`evidence_type` text NOT NULL,
	`evidence_note` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `name_suggestions_dish_proposer_name_unique` ON `name_suggestions` (`dish_id`,`proposer_id`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `name_suggestions_dish_status_idx` ON `name_suggestions` (`dish_id`,`status`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`dish_id` text,
	`meal_id` text,
	`reason` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reports_target_check" CHECK(("reports"."dish_id" is not null) <> ("reports"."meal_id" is not null))
);
--> statement-breakpoint
CREATE INDEX `reports_status_created_idx` ON `reports` (`status`,`created_at`);--> statement-breakpoint
DROP INDEX `servings_dish_venue_date_unique`;--> statement-breakpoint
ALTER TABLE `photos` ADD `content_sha256` text;--> statement-breakpoint
CREATE UNIQUE INDEX `photos_creator_sha256_unique` ON `photos` (`creator_id`,`content_sha256`);