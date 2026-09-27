CREATE TABLE "demo_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"category" varchar(50),
	"status" varchar(50) DEFAULT 'todo' NOT NULL,
	"owner" varchar(50),
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"amount" numeric(10, 2),
	"quantity" integer,
	"progress" integer DEFAULT 0 NOT NULL,
	"start_date" date,
	"end_date" date,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"cover" varchar(36),
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "demo_records_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "demo_records" ADD CONSTRAINT "demo_records_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."demo_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "demo_records_parent_id_idx" ON "demo_records" USING btree ("parent_id");