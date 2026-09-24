CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" varchar(200) NOT NULL,
	"created_at" timestamp,
	CONSTRAINT "admin_users_username_key" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "menus" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"icon" varchar(100),
	"path" varchar(200),
	"component" varchar(200),
	"parent_id" integer,
	"sort_order" integer,
	"is_visible" boolean,
	"is_active" boolean,
	"menu_type" varchar(20),
	"description" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "menus_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "role_menus" (
	"role_id" integer NOT NULL,
	"menu_id" integer NOT NULL,
	CONSTRAINT "role_menus_pkey" PRIMARY KEY("role_id","menu_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" text,
	"created_at" timestamp,
	CONSTRAINT "roles_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	CONSTRAINT "user_roles_pkey" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "login_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(100) NOT NULL,
	"user_id" integer,
	"status" varchar(20) NOT NULL,
	"ip" varchar(64),
	"user_agent" varchar(500),
	"message" varchar(500),
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "operation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(100) NOT NULL,
	"user_id" integer,
	"module" varchar(100) NOT NULL,
	"action" varchar(50) NOT NULL,
	"method" varchar(10) NOT NULL,
	"path" varchar(255) NOT NULL,
	"target_id" varchar(100),
	"payload" text,
	"ip" varchar(64),
	"user_agent" varchar(500),
	"status_code" integer,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "dict_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"dict_type_id" integer NOT NULL,
	"label" varchar(100) NOT NULL,
	"value" varchar(100) NOT NULL,
	"color" varchar(30),
	"sort_order" integer,
	"is_default" boolean,
	"is_active" boolean,
	"description" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "uq_dict_items_type_value" UNIQUE("dict_type_id","value")
);
--> statement-breakpoint
CREATE TABLE "dict_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(100) NOT NULL,
	"description" text,
	"sort_order" integer,
	"is_active" boolean,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "dict_types_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "scheduled_task_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"trigger_type" varchar(20),
	"status" varchar(20) NOT NULL,
	"response_status" integer,
	"response_body" text,
	"error_message" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"duration_ms" integer,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "scheduled_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"task_code" varchar(120) NOT NULL,
	"cron_expression" varchar(120) NOT NULL,
	"request_method" varchar(10),
	"request_url" varchar(500) NOT NULL,
	"request_headers" text,
	"request_body" text,
	"timeout_seconds" integer,
	"is_active" boolean,
	"remark" text,
	"last_status" varchar(20),
	"last_error" text,
	"last_duration_ms" integer,
	"run_count" integer,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "scheduled_tasks_task_code_key" UNIQUE("task_code")
);
--> statement-breakpoint
CREATE TABLE "notification_reads" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"read_at" timestamp,
	CONSTRAINT "notification_reads_notification_id_user_id_key" UNIQUE("notification_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text,
	"noti_type" varchar(20) DEFAULT 'info' NOT NULL,
	"link" varchar(500),
	"is_global" boolean DEFAULT true,
	"user_id" integer,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(100) NOT NULL,
	"content" text,
	"announce_type" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"is_top" boolean,
	"sort_order" integer,
	"publish_at" timestamp,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "query_management_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"query_management_id" integer NOT NULL,
	"version_no" integer NOT NULL,
	"action" varchar(20),
	"snapshot_json" text NOT NULL,
	"operator" varchar(100),
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "query_managements" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"query_code" varchar(120) NOT NULL,
	"category" varchar(50),
	"keyword" varchar(200),
	"data_source" varchar(100),
	"owner" varchar(100),
	"priority" integer,
	"is_active" boolean,
	"description" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	"image_url" varchar(500),
	"image_urls" text,
	"file_url" varchar(500),
	"file_urls" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"condition_logic" varchar(10) DEFAULT 'AND',
	"conditions_json" text,
	"display_config" text,
	"permission_config" text,
	"schema_config" text,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp,
	CONSTRAINT "query_managements_query_code_key" UNIQUE("query_code")
);
--> statement-breakpoint
CREATE TABLE "tree_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"node_code" varchar(120) NOT NULL,
	"parent_id" integer,
	"node_type" varchar(50) DEFAULT 'category',
	"icon" varchar(100),
	"description" text,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"status" varchar(20) DEFAULT 'active',
	"owner" varchar(100),
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "tree_nodes_node_code_key" UNIQUE("node_code")
);
--> statement-breakpoint
CREATE TABLE "stats_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"item_code" varchar(120) NOT NULL,
	"category" varchar(50),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"amount" numeric(14, 2) DEFAULT '0',
	"quantity" integer DEFAULT 0,
	"owner" varchar(100),
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"description" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "stats_items_item_code_key" UNIQUE("item_code")
);
--> statement-breakpoint
CREATE TABLE "card_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(120) NOT NULL,
	"card_code" varchar(120) NOT NULL,
	"subtitle" varchar(200),
	"category" varchar(50),
	"cover_url" varchar(500),
	"tag" varchar(50),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"owner" varchar(100),
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"description" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "card_items_card_code_key" UNIQUE("card_code")
);
--> statement-breakpoint
CREATE TABLE "dynamic_form_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"field_key" varchar(100),
	"field_value" varchar(500),
	"field_type" varchar(50) DEFAULT 'text',
	"sort_order" integer DEFAULT 0,
	"remark" varchar(200),
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "dynamic_form_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(120) NOT NULL,
	"record_code" varchar(120) NOT NULL,
	"category" varchar(50) DEFAULT 'general',
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"owner" varchar(100),
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"description" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "dynamic_form_records_record_code_key" UNIQUE("record_code")
);
--> statement-breakpoint
CREATE TABLE "kanban_boards" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(100) NOT NULL,
	"board_code" varchar(50) NOT NULL,
	"color" varchar(20) DEFAULT '#4080FF',
	"sort_order" integer DEFAULT 0,
	"wip_limit" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "kanban_boards_board_code_key" UNIQUE("board_code")
);
--> statement-breakpoint
CREATE TABLE "kanban_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"card_code" varchar(80) NOT NULL,
	"description" text,
	"priority" varchar(20) DEFAULT 'medium',
	"assignee" varchar(100),
	"due_date" date,
	"tags" varchar(200),
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "kanban_cards_card_code_key" UNIQUE("card_code")
);
--> statement-breakpoint
CREATE TABLE "cc_detail_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"department" varchar(100),
	"role_title" varchar(100),
	"email" varchar(200),
	"phone" varchar(50),
	"status" varchar(20) DEFAULT 'active',
	"join_date" date,
	"avatar_color" varchar(20) DEFAULT '#4080FF',
	"bio" text,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "cc_gantt_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"task_type" varchar(20) DEFAULT 'task',
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"progress" integer DEFAULT 0,
	"assignee" varchar(100),
	"priority" varchar(20) DEFAULT 'medium',
	"status" varchar(20) DEFAULT 'not_started',
	"color" varchar(20) DEFAULT '#4080FF',
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "cc_advanced_table_rows" (
	"id" serial PRIMARY KEY NOT NULL,
	"row_code" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"category" varchar(50) DEFAULT 'general',
	"owner" varchar(100),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"priority" integer DEFAULT 0,
	"progress" integer DEFAULT 0,
	"score" numeric(7, 2) DEFAULT '0',
	"tags" varchar(255),
	"is_active" boolean DEFAULT true,
	"is_pinned" boolean DEFAULT false,
	"due_date" date,
	"sort_order" integer DEFAULT 0,
	"remark" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "cc_advanced_table_rows_row_code_key" UNIQUE("row_code")
);
--> statement-breakpoint
CREATE TABLE "ai_prompt_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"category" varchar(50) DEFAULT 'custom',
	"description" text,
	"content" text NOT NULL,
	"variables" json,
	"tags" varchar(500) DEFAULT '',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_menus" ADD CONSTRAINT "role_menus_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_menus" ADD CONSTRAINT "role_menus_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_logs" ADD CONSTRAINT "login_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dict_items" ADD CONSTRAINT "dict_items_dict_type_id_fkey" FOREIGN KEY ("dict_type_id") REFERENCES "public"."dict_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_task_runs" ADD CONSTRAINT "scheduled_task_runs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."scheduled_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_management_versions" ADD CONSTRAINT "query_management_versions_query_management_id_fkey" FOREIGN KEY ("query_management_id") REFERENCES "public"."query_managements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_nodes" ADD CONSTRAINT "tree_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."tree_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_form_fields" ADD CONSTRAINT "dynamic_form_fields_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "public"."dynamic_form_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_cards" ADD CONSTRAINT "kanban_cards_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_login_logs_status_created_at" ON "login_logs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "ix_dict_items_dict_type_id" ON "dict_items" USING btree ("dict_type_id");--> statement-breakpoint
CREATE INDEX "ix_scheduled_task_runs_status" ON "scheduled_task_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_scheduled_task_runs_task_id" ON "scheduled_task_runs" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "ix_scheduled_tasks_is_active" ON "scheduled_tasks" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ix_scheduled_tasks_next_run_at" ON "scheduled_tasks" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "ix_query_management_versions_query_management_id" ON "query_management_versions" USING btree ("query_management_id");--> statement-breakpoint
CREATE INDEX "ix_query_managements_category" ON "query_managements" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ix_query_managements_is_active" ON "query_managements" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ix_query_managements_owner" ON "query_managements" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "ix_ai_prompt_templates_category" ON "ai_prompt_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ix_ai_prompt_templates_name" ON "ai_prompt_templates" USING btree ("name");