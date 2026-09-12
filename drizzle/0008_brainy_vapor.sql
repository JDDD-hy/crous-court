CREATE TABLE `governance_rate_limits` (
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`attempts` integer NOT NULL,
	PRIMARY KEY(`user_id`, `action`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "governance_rate_limits_attempts_check" CHECK("governance_rate_limits"."attempts" between 1 and 30)
);
