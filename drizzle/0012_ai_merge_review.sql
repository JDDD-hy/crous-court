CREATE TABLE `ai_merge_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`pair_key` text NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`uncertainty` text NOT NULL,
	`model` text NOT NULL,
	`requested_by` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ai_merge_distinct" CHECK("ai_merge_suggestions"."source_id" <> "ai_merge_suggestions"."target_id"),
	CONSTRAINT "ai_merge_status" CHECK("ai_merge_suggestions"."status" in ('pending','accepted','rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_merge_pair_unique` ON `ai_merge_suggestions` (`pair_key`);