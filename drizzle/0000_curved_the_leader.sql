CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`payload` text NOT NULL,
	`storage_key` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `artifacts_project` ON `artifacts` (`project_id`);--> statement-breakpoint
CREATE TABLE `interaction_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`project_id` text,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_project` ON `interaction_events` (`project_id`);--> statement-breakpoint
CREATE TABLE `generations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`owner` text NOT NULL,
	`request_key` text NOT NULL,
	`status` text NOT NULL,
	`capability` text NOT NULL,
	`provider` text NOT NULL,
	`input` text NOT NULL,
	`artifact_id` text,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generations_request_key` ON `generations` (`owner`,`request_key`);--> statement-breakpoint
CREATE INDEX `generations_project` ON `generations` (`project_id`);--> statement-breakpoint
CREATE INDEX `generations_owner_created` ON `generations` (`owner`,`created_at`);--> statement-breakpoint
CREATE TABLE `journey_settings` (
	`journey_id` text PRIMARY KEY NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `journey_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`journey_id` text NOT NULL,
	`version` integer NOT NULL,
	`definition` text NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journey_version_unique` ON `journey_versions` (`journey_id`,`version`);--> statement-breakpoint
CREATE TABLE `preferences` (
	`owner` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`journey` text NOT NULL,
	`session` text NOT NULL,
	`status` text NOT NULL,
	`kept` integer DEFAULT 0 NOT NULL,
	`active_artifact_id` text,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_owner_updated` ON `projects` (`owner`,`updated_at`);--> statement-breakpoint
CREATE TABLE `provider_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`encrypted_key` text NOT NULL,
	`model` text NOT NULL,
	`updated_at` text NOT NULL
);
