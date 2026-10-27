ALTER TABLE `records` ADD `created_via` text DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE `records` ADD `updated_via` text DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE `records` ADD `request_id` text;--> statement-breakpoint
ALTER TABLE `records` ADD `create_fingerprint` text;--> statement-breakpoint
CREATE UNIQUE INDEX `records_user_request` ON `records` (`user_id`,`request_id`);