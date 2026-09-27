-- The component gallery's old page templates (the "管理系统" directory) are replaced by the page patterns on the shared
-- demo_records table (0003 / 0004). This drops their twelve demo tables — demo data only — child tables first, so no
-- CASCADE is needed — and the saved-query file references that pointed into one of them.
DELETE FROM "file_references" WHERE "ref_table" = 'saved_queries';--> statement-breakpoint
DROP TABLE "saved_query_versions";--> statement-breakpoint
DROP TABLE "saved_queries";--> statement-breakpoint
DROP TABLE "tree_nodes";--> statement-breakpoint
DROP TABLE "stats_items";--> statement-breakpoint
DROP TABLE "card_items";--> statement-breakpoint
DROP TABLE "dynamic_form_fields";--> statement-breakpoint
DROP TABLE "dynamic_form_records";--> statement-breakpoint
DROP TABLE "kanban_cards";--> statement-breakpoint
DROP TABLE "kanban_boards";--> statement-breakpoint
DROP TABLE "detail_members";--> statement-breakpoint
DROP TABLE "gantt_tasks";--> statement-breakpoint
DROP TABLE "advanced_table_rows";--> statement-breakpoint
-- Deleting the "管理系统" directory and its nine pages removes their buttons (menus.parent_id cascades) and every role
-- grant on them (role_menus.menu_id cascades). seed-rbac never deletes menus, so existing databases need this; on a
-- fresh database it matches nothing.
DELETE FROM "menus" WHERE "code" IN (
  'cc_admin', 'cc_admin_list', 'cc_admin_stats_list', 'cc_admin_card_list', 'cc_admin_tree_list', 'cc_admin_dynamic_form',
  'cc_admin_kanban', 'cc_admin_detail_tabs', 'cc_admin_gantt', 'cc_admin_advanced_table'
);
