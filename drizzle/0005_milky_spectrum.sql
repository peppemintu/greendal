CREATE TABLE `newsletter_sends` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` integer NOT NULL,
	`week_end` integer NOT NULL,
	`sent_at` integer NOT NULL,
	`post_count` integer NOT NULL,
	`recipient_count` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_sends_week_start_unique` ON `newsletter_sends` (`week_start`);--> statement-breakpoint
CREATE TABLE `subscribers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`user_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`confirm_token_hash` text,
	`unsubscribe_token` text NOT NULL,
	`created_at` integer NOT NULL,
	`confirmed_at` integer,
	`unsubscribed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_email_unique` ON `subscribers` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_unsubscribe_token_unique` ON `subscribers` (`unsubscribe_token`);