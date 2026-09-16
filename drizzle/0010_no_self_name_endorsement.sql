DELETE FROM `name_endorsements`
WHERE EXISTS (
  SELECT 1 FROM `name_suggestions`
  WHERE `name_suggestions`.`id` = `name_endorsements`.`suggestion_id`
    AND `name_suggestions`.`proposer_id` = `name_endorsements`.`user_id`
);
--> statement-breakpoint
CREATE TRIGGER `name_endorsements_no_self_insert`
BEFORE INSERT ON `name_endorsements`
WHEN EXISTS (
  SELECT 1 FROM `name_suggestions`
  WHERE `name_suggestions`.`id` = NEW.`suggestion_id`
    AND `name_suggestions`.`proposer_id` = NEW.`user_id`
)
BEGIN
  SELECT RAISE(ABORT, 'proposer cannot endorse own suggestion');
END;
