-- The kanban gets its own card order: sort_order stays the tree's sibling order, board_order is the order within a
-- status column. Existing rows keep a stable board order: numbered from 0 per status, in their current
-- (sort_order, id) order.
ALTER TABLE "demo_records" ADD COLUMN "board_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "demo_records" AS d
SET "board_order" = r.rn
FROM (
	SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "status" ORDER BY "sort_order", "id") - 1)::integer AS rn
	FROM "demo_records"
) AS r
WHERE d."id" = r."id";
