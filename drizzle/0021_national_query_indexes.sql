CREATE INDEX `photos_meal_id_idx` ON `photos` (`meal_id`,`id`);--> statement-breakpoint
CREATE INDEX `servings_dish_status_date_idx` ON `servings` (`dish_id`,`status`,`served_on`);