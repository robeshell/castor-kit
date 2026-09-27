UPDATE "query_managements" SET "image_urls" = json_build_array("image_url")::text WHERE coalesce("image_url", '') <> '' AND coalesce("image_urls", '') IN ('', '[]');--> statement-breakpoint
UPDATE "query_managements" SET "file_urls" = json_build_array("file_url")::text WHERE coalesce("file_url", '') <> '' AND coalesce("file_urls", '') IN ('', '[]');--> statement-breakpoint
ALTER TABLE "query_managements" DROP COLUMN "image_url";--> statement-breakpoint
ALTER TABLE "query_managements" DROP COLUMN "file_url";
