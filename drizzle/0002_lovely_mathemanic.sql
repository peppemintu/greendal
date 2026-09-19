CREATE TABLE IF NOT EXISTS `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer,
	`recipe_id` integer,
	`author_id` integer NOT NULL,
	`parent_id` integer,
	`body` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`edited_at` integer,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "comments_exactly_one_parent" CHECK(("comments"."post_id" is not null and "comments"."recipe_id" is null) or ("comments"."post_id" is null and "comments"."recipe_id" is not null))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `comments_post_created_idx` ON `comments` (`post_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `comments_recipe_created_idx` ON `comments` (`recipe_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `comments_author_idx` ON `comments` (`author_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `comments_parent_idx` ON `comments` (`parent_id`);