CREATE TABLE `upload_rate_limits` (
	`user_id` text PRIMARY KEY NOT NULL,
	`window_started_at` integer NOT NULL,
	`attempts` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "upload_rate_limits_attempts_check" CHECK("upload_rate_limits"."attempts" between 1 and 5)
);
