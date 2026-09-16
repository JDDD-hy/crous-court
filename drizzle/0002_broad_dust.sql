CREATE TABLE `auth_sessions` (
	`token_digest` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `email_otp_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`email_digest` text NOT NULL,
	`code_digest` text NOT NULL,
	`ip_digest` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` integer,
	`session_id` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "email_otp_challenges_attempts_check" CHECK("email_otp_challenges"."attempts" between 0 and 5)
);
--> statement-breakpoint
CREATE INDEX `email_otp_challenges_email_created_idx` ON `email_otp_challenges` (`email_digest`,`created_at`);--> statement-breakpoint
CREATE INDEX `email_otp_challenges_ip_created_idx` ON `email_otp_challenges` (`ip_digest`,`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `email_digest` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_digest_unique` ON `users` (`email_digest`);