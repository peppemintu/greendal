ALTER TABLE `posts` ADD `blocks` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `recipes` ADD `archived_at` integer;