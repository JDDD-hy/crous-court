DROP INDEX `venues_canonical_name_unique`;--> statement-breakpoint
ALTER TABLE `venues` ADD `timezone` text DEFAULT 'Europe/Paris' NOT NULL;--> statement-breakpoint
CREATE INDEX `venues_canonical_name_idx` ON `venues` (`canonical_name`);--> statement-breakpoint
