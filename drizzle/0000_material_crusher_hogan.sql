CREATE TABLE `dishes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`image_path` text,
	`tags` text DEFAULT '[]',
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_dishes_status` ON `dishes` (`status`);--> statement-breakpoint
CREATE TABLE `meal_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '饭局' NOT NULL,
	`meal_type` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`dining_time` text NOT NULL,
	`create_lead_hours` integer DEFAULT 16 NOT NULL,
	`deadline_lead_minutes` integer DEFAULT 120 NOT NULL,
	`weekdays` text DEFAULT '[0,1,2,3,4,5,6]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meals` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`meal_type` text NOT NULL,
	`date` text NOT NULL,
	`dining_time` integer NOT NULL,
	`order_deadline` integer NOT NULL,
	`cook_id` text,
	`status` text DEFAULT 'ordering' NOT NULL,
	`is_auto` integer DEFAULT false NOT NULL,
	`schedule_id` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cook_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`schedule_id`) REFERENCES `meal_schedules`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_meals_status` ON `meals` (`status`);--> statement-breakpoint
CREATE INDEX `idx_meals_date` ON `meals` (`date`);--> statement-breakpoint
CREATE INDEX `idx_meals_schedule` ON `meals` (`schedule_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_id` text NOT NULL,
	`dish_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_orders_meal` ON `orders` (`meal_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_user` ON `orders` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_order` ON `orders` (`meal_id`,`dish_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_meal` ON `reviews` (`meal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_review` ON `reviews` (`meal_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`avatar_path` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_name_unique` ON `users` (`name`);