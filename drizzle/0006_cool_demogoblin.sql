CREATE TABLE `ai_rate_limits` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`attempts` integer NOT NULL,
	PRIMARY KEY(`user_id`, `day`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ai_rate_limits_attempts_check" CHECK("ai_rate_limits"."attempts" between 1 and 3)
);
