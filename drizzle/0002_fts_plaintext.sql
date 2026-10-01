-- Re-author the messages FTS triggers to index extracted plain text instead of
-- the raw JSON-serialized `parts` array. Indexing NEW.parts polluted the FTS
-- `body` with JSON keys/punctuation ("type", "text", braces) so a search for
-- "text" matched essentially every message and real prose ranked poorly. We now
-- concatenate only the `text`-part bodies via json_each over the parts array.
DROP TRIGGER IF EXISTS `messages_fts_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `messages_fts_au`;
--> statement-breakpoint
CREATE TRIGGER `messages_fts_ai` AFTER INSERT ON `messages` BEGIN
	INSERT INTO `messages_fts` (`row_id`, `conversation_id`, `body`)
	VALUES (
		NEW.`id`,
		NEW.`conversation_id`,
		(SELECT group_concat(json_extract(value, '$.text'), ' ')
		 FROM json_each(NEW.`parts`)
		 WHERE json_extract(value, '$.type') = 'text')
	);
END;
--> statement-breakpoint
CREATE TRIGGER `messages_fts_au` AFTER UPDATE ON `messages` BEGIN
	DELETE FROM `messages_fts` WHERE `row_id` = OLD.`id`;
	INSERT INTO `messages_fts` (`row_id`, `conversation_id`, `body`)
	VALUES (
		NEW.`id`,
		NEW.`conversation_id`,
		(SELECT group_concat(json_extract(value, '$.text'), ' ')
		 FROM json_each(NEW.`parts`)
		 WHERE json_extract(value, '$.type') = 'text')
	);
END;
--> statement-breakpoint
-- Rebuild already-indexed rows so existing messages get plain-text bodies.
DELETE FROM `messages_fts`;
--> statement-breakpoint
INSERT INTO `messages_fts` (`row_id`, `conversation_id`, `body`)
SELECT
	`id`,
	`conversation_id`,
	(SELECT group_concat(json_extract(value, '$.text'), ' ')
	 FROM json_each(`messages`.`parts`)
	 WHERE json_extract(value, '$.type') = 'text')
FROM `messages`;
