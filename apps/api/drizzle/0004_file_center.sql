CREATE TABLE "file_references" (
	"file_id" uuid NOT NULL,
	"ref_table" varchar(50) NOT NULL,
	"ref_id" varchar(50) NOT NULL,
	"ref_field" varchar(50) NOT NULL,
	"created_at" timestamp,
	CONSTRAINT "file_references_pkey" PRIMARY KEY("file_id","ref_table","ref_id","ref_field")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage" varchar(20) NOT NULL,
	"bucket" varchar(100),
	"object_key" varchar(200) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"uploader_id" integer,
	"created_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "file_references" ADD CONSTRAINT "file_references_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_references_ref_idx" ON "file_references" USING btree ("ref_table","ref_id");--> statement-breakpoint
CREATE INDEX "files_sha256_idx" ON "files" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "files_created_at_idx" ON "files" USING btree ("created_at");