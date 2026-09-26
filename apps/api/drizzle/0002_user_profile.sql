ALTER TABLE "admin_users" ADD COLUMN "nickname" varchar(100);--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "email" varchar(100);--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "avatar" varchar(500);--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "dept_id" integer;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "last_login_ip" varchar(64);--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_email_key" UNIQUE("email");