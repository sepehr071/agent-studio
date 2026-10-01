CREATE TABLE `configs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`avatar_emoji` text,
	`system_prompt` text DEFAULT '' NOT NULL,
	`model_id` text NOT NULL,
	`params` text,
	`is_pinned` integer DEFAULT false NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `configs_pinned_idx` ON `configs` (`is_pinned`);--> statement-breakpoint
CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`parent_id` text,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `folders_project_idx` ON `folders` (`project_id`);--> statement-breakpoint
CREATE INDEX `folders_parent_idx` ON `folders` (`parent_id`);--> statement-breakpoint
CREATE TABLE `generated_images` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`negative_prompt` text,
	`model_id` text NOT NULL,
	`mode` text DEFAULT 't2i' NOT NULL,
	`aspect_hint` text,
	`style_hint` text,
	`file_path` text NOT NULL,
	`mime_type` text DEFAULT 'image/png' NOT NULL,
	`width` integer,
	`height` integer,
	`input_image_paths` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `generated_images_created_idx` ON `generated_images` (`created_at`);--> statement-breakpoint
CREATE TABLE `knowledge_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `knowledge_folders_parent_idx` ON `knowledge_folders` (`parent_id`);--> statement-breakpoint
CREATE TABLE `knowledge_items` (
	`id` text PRIMARY KEY NOT NULL,
	`folder_id` text,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`source_conversation_id` text,
	`source_message_id` text,
	`model_id` text,
	`tags` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`folder_id`) REFERENCES `knowledge_folders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `knowledge_items_folder_idx` ON `knowledge_items` (`folder_id`);--> statement-breakpoint
CREATE INDEX `knowledge_items_favorite_idx` ON `knowledge_items` (`is_favorite`);--> statement-breakpoint
CREATE TABLE `meeting_series` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email_tone` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meeting_series_keyterms` (
	`id` text PRIMARY KEY NOT NULL,
	`series_id` text NOT NULL,
	`term` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`series_id`) REFERENCES `meeting_series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meeting_series_keyterms_series_idx` ON `meeting_series_keyterms` (`series_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `meeting_series_keyterms_series_term_uniq` ON `meeting_series_keyterms` (`series_id`,`term`);--> statement-breakpoint
CREATE TABLE `meeting_series_speaker_names` (
	`id` text PRIMARY KEY NOT NULL,
	`series_id` text NOT NULL,
	`display_name` text NOT NULL,
	`last_seen_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`series_id`) REFERENCES `meeting_series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meeting_series_speaker_names_series_idx` ON `meeting_series_speaker_names` (`series_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `meeting_series_speaker_names_series_name_uniq` ON `meeting_series_speaker_names` (`series_id`,`display_name`);--> statement-breakpoint
CREATE TABLE `meeting_speakers` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`speaker_id` text NOT NULL,
	`display_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meeting_speakers_meeting_idx` ON `meeting_speakers` (`meeting_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `meeting_speakers_meeting_speaker_uniq` ON `meeting_speakers` (`meeting_id`,`speaker_id`);--> statement-breakpoint
CREATE TABLE `meeting_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`exec_summary` text,
	`action_items_json` text,
	`decisions_json` text,
	`minutes_json` text,
	`qa_json` text,
	`open_questions_json` text,
	`email_subject` text,
	`email_body` text,
	`email_tone` text,
	`model` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meeting_summaries_meeting_idx` ON `meeting_summaries` (`meeting_id`);--> statement-breakpoint
CREATE TABLE `meeting_transcripts` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`raw_json` text,
	`plain_text` text DEFAULT '' NOT NULL,
	`words_json` text,
	`language_code` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meeting_transcripts_meeting_idx` ON `meeting_transcripts` (`meeting_id`);--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT 'جلسه بدون عنوان' NOT NULL,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`stage` text,
	`audio_path` text,
	`language` text DEFAULT 'fas' NOT NULL,
	`duration_s` integer,
	`num_speakers` integer,
	`meeting_brief` text,
	`series_id` text,
	`email_tone` text,
	`error_message` text,
	`latest_summary_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meetings_status_idx` ON `meetings` (`status`);--> statement-breakpoint
CREATE INDEX `meetings_series_idx` ON `meetings` (`series_id`);--> statement-breakpoint
CREATE INDEX `meetings_created_idx` ON `meetings` (`created_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`emoji` text,
	`is_pinned` integer DEFAULT false NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_sort_idx` ON `projects` (`sort_order`);--> statement-breakpoint
CREATE TABLE `prompt_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`variables` text,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prompt_templates_category_idx` ON `prompt_templates` (`category`);--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`ext` text,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`file_path` text NOT NULL,
	`extracted_text` text,
	`extract_status` text DEFAULT 'unavailable' NOT NULL,
	`conversation_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `uploads_conversation_idx` ON `uploads` (`conversation_id`);--> statement-breakpoint
CREATE TABLE `usage_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`provider` text,
	`feature` text NOT NULL,
	`conversation_id` text,
	`meeting_id` text,
	`image_id` text,
	`prompt_tokens` integer,
	`completion_tokens` integer,
	`reasoning_tokens` integer,
	`cached_tokens` integer,
	`total_tokens` integer,
	`cost_usd` real,
	`generation_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `usage_logs_created_idx` ON `usage_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `usage_logs_model_idx` ON `usage_logs` (`model`);--> statement-breakpoint
CREATE INDEX `usage_logs_feature_idx` ON `usage_logs` (`feature`);--> statement-breakpoint
ALTER TABLE `conversations` ADD `project_id` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `folder_id` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `config_id` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `origin_meeting_id` text;--> statement-breakpoint
CREATE INDEX `conversations_project_idx` ON `conversations` (`project_id`);--> statement-breakpoint
CREATE INDEX `conversations_folder_idx` ON `conversations` (`folder_id`);--> statement-breakpoint
CREATE INDEX `conversations_config_idx` ON `conversations` (`config_id`);--> statement-breakpoint
CREATE VIRTUAL TABLE `messages_fts` USING fts5(
	`row_id` UNINDEXED,
	`conversation_id` UNINDEXED,
	`body`,
	tokenize = 'unicode61 remove_diacritics 0'
);
--> statement-breakpoint
CREATE TRIGGER `messages_fts_ai` AFTER INSERT ON `messages` BEGIN
	INSERT INTO `messages_fts` (`row_id`, `conversation_id`, `body`)
	VALUES (NEW.`id`, NEW.`conversation_id`, NEW.`parts`);
END;
--> statement-breakpoint
CREATE TRIGGER `messages_fts_ad` AFTER DELETE ON `messages` BEGIN
	DELETE FROM `messages_fts` WHERE `row_id` = OLD.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `messages_fts_au` AFTER UPDATE ON `messages` BEGIN
	DELETE FROM `messages_fts` WHERE `row_id` = OLD.`id`;
	INSERT INTO `messages_fts` (`row_id`, `conversation_id`, `body`)
	VALUES (NEW.`id`, NEW.`conversation_id`, NEW.`parts`);
END;
--> statement-breakpoint
CREATE VIRTUAL TABLE `knowledge_fts` USING fts5(
	`row_id` UNINDEXED,
	`title`,
	`content`,
	tokenize = 'unicode61 remove_diacritics 0'
);
--> statement-breakpoint
CREATE TRIGGER `knowledge_fts_ai` AFTER INSERT ON `knowledge_items` BEGIN
	INSERT INTO `knowledge_fts` (`row_id`, `title`, `content`)
	VALUES (NEW.`id`, NEW.`title`, NEW.`content`);
END;
--> statement-breakpoint
CREATE TRIGGER `knowledge_fts_ad` AFTER DELETE ON `knowledge_items` BEGIN
	DELETE FROM `knowledge_fts` WHERE `row_id` = OLD.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `knowledge_fts_au` AFTER UPDATE ON `knowledge_items` BEGIN
	DELETE FROM `knowledge_fts` WHERE `row_id` = OLD.`id`;
	INSERT INTO `knowledge_fts` (`row_id`, `title`, `content`)
	VALUES (NEW.`id`, NEW.`title`, NEW.`content`);
END;
--> statement-breakpoint
CREATE VIRTUAL TABLE `transcripts_fts` USING fts5(
	`row_id` UNINDEXED,
	`meeting_id` UNINDEXED,
	`body`,
	tokenize = 'unicode61 remove_diacritics 0'
);
--> statement-breakpoint
CREATE TRIGGER `transcripts_fts_ai` AFTER INSERT ON `meeting_transcripts` BEGIN
	INSERT INTO `transcripts_fts` (`row_id`, `meeting_id`, `body`)
	VALUES (NEW.`id`, NEW.`meeting_id`, NEW.`plain_text`);
END;
--> statement-breakpoint
CREATE TRIGGER `transcripts_fts_ad` AFTER DELETE ON `meeting_transcripts` BEGIN
	DELETE FROM `transcripts_fts` WHERE `row_id` = OLD.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `transcripts_fts_au` AFTER UPDATE ON `meeting_transcripts` BEGIN
	DELETE FROM `transcripts_fts` WHERE `row_id` = OLD.`id`;
	INSERT INTO `transcripts_fts` (`row_id`, `meeting_id`, `body`)
	VALUES (NEW.`id`, NEW.`meeting_id`, NEW.`plain_text`);
END;
