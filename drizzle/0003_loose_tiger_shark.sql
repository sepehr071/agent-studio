CREATE TABLE `mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`transport` text NOT NULL,
	`url` text,
	`headers` text,
	`command` text,
	`args` text,
	`env` text,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mcp_servers_enabled_idx` ON `mcp_servers` (`is_enabled`);--> statement-breakpoint
ALTER TABLE `configs` ADD `tool_config` text;