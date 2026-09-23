CREATE TABLE `dish_history_pages` (
	`dish_id` text NOT NULL,
	`page` integer NOT NULL,
	`rows_json` text NOT NULL,
	PRIMARY KEY(`dish_id`, `page`),
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "dish_history_pages_page_check" CHECK("dish_history_pages"."page" between 1 and 10000)
);
--> statement-breakpoint
CREATE TRIGGER votes_history_pages_insert AFTER INSERT ON votes
BEGIN DELETE FROM dish_history_pages WHERE dish_id=NEW.dish_id; END;
--> statement-breakpoint
CREATE TRIGGER votes_history_pages_delete AFTER DELETE ON votes
BEGIN DELETE FROM dish_history_pages WHERE dish_id=OLD.dish_id; END;
--> statement-breakpoint
CREATE TRIGGER votes_history_pages_update AFTER UPDATE ON votes
BEGIN DELETE FROM dish_history_pages WHERE dish_id IN (OLD.dish_id,NEW.dish_id); END;
