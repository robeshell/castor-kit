CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" varchar(200) NOT NULL,
	"nickname" varchar(100),
	"email" varchar(100),
	"phone" varchar(20),
	"avatar" varchar(500),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"dept_id" integer,
	"last_login_at" timestamp,
	"last_login_ip" varchar(64),
	"totp_secret" text,
	"totp_enabled_at" timestamp,
	"totp_last_step" integer,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "admin_users_username_unique" UNIQUE("username"),
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"leader_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "departments_code_unique" UNIQUE("code")
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
	CONSTRAINT "menus_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "role_depts" (
	"role_id" integer NOT NULL,
	"dept_id" integer NOT NULL,
	CONSTRAINT "role_depts_pkey" PRIMARY KEY("role_id","dept_id")
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
	"data_scope" varchar(20) DEFAULT 'all' NOT NULL,
	"created_at" timestamp,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
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
	"api_token_id" integer,
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
	CONSTRAINT "dict_items_type_value_unique" UNIQUE("dict_type_id","value")
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
	CONSTRAINT "dict_types_code_unique" UNIQUE("code")
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
	CONSTRAINT "scheduled_tasks_task_code_unique" UNIQUE("task_code")
);
--> statement-breakpoint
CREATE TABLE "notification_reads" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"read_at" timestamp,
	CONSTRAINT "notification_reads_notification_id_user_id_unique" UNIQUE("notification_id","user_id")
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
CREATE TABLE "app_state" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp
);
--> statement-breakpoint
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
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"requested_ip" varchar(64),
	"created_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ip" varchar(64),
	"user_agent" varchar(500),
	"mfa_state" varchar(20),
	"created_at" timestamp,
	"last_seen_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"verified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "user_recovery_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"created_at" timestamp,
	"used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"token_prefix" varchar(16) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"scopes" jsonb NOT NULL,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"last_used_ip" varchar(64),
	"created_by" integer NOT NULL,
	"created_at" timestamp,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"webhook_id" integer NOT NULL,
	"event_id" uuid NOT NULL,
	"event" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"response_code" integer,
	"response_body" text,
	"next_retry_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"url" varchar(500) NOT NULL,
	"events" jsonb NOT NULL,
	"secret" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "saved_queries" (
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
	"image_urls" text,
	"file_urls" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"condition_logic" varchar(10) DEFAULT 'AND',
	"conditions_json" text,
	"display_config" text,
	"permission_config" text,
	"schema_config" text,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp,
	CONSTRAINT "saved_queries_query_code_unique" UNIQUE("query_code")
);
--> statement-breakpoint
CREATE TABLE "saved_query_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"query_id" integer NOT NULL,
	"version_no" integer NOT NULL,
	"action" varchar(20),
	"snapshot_json" text NOT NULL,
	"operator" varchar(100),
	"created_at" timestamp
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
	CONSTRAINT "tree_nodes_node_code_unique" UNIQUE("node_code")
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
	CONSTRAINT "stats_items_item_code_unique" UNIQUE("item_code")
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
	CONSTRAINT "card_items_card_code_unique" UNIQUE("card_code")
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
	CONSTRAINT "dynamic_form_records_record_code_unique" UNIQUE("record_code")
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
	CONSTRAINT "kanban_boards_board_code_unique" UNIQUE("board_code")
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
	CONSTRAINT "kanban_cards_card_code_unique" UNIQUE("card_code")
);
--> statement-breakpoint
CREATE TABLE "detail_members" (
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
CREATE TABLE "gantt_tasks" (
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
CREATE TABLE "advanced_table_rows" (
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
	CONSTRAINT "advanced_table_rows_row_code_unique" UNIQUE("row_code")
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
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_leader_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_depts" ADD CONSTRAINT "role_depts_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_depts" ADD CONSTRAINT "role_depts_dept_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_menus" ADD CONSTRAINT "role_menus_menu_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_menus" ADD CONSTRAINT "role_menus_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_logs" ADD CONSTRAINT "login_logs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_api_token_id_fk" FOREIGN KEY ("api_token_id") REFERENCES "public"."api_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dict_items" ADD CONSTRAINT "dict_items_dict_type_id_fk" FOREIGN KEY ("dict_type_id") REFERENCES "public"."dict_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_task_runs" ADD CONSTRAINT "scheduled_task_runs_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."scheduled_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_references" ADD CONSTRAINT "file_references_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploader_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_recovery_codes" ADD CONSTRAINT "user_recovery_codes_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_query_versions" ADD CONSTRAINT "saved_query_versions_query_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."saved_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_nodes" ADD CONSTRAINT "tree_nodes_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tree_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_form_fields" ADD CONSTRAINT "dynamic_form_fields_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."dynamic_form_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_cards" ADD CONSTRAINT "kanban_cards_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_logs_status_created_at_idx" ON "login_logs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "dict_items_dict_type_id_idx" ON "dict_items" USING btree ("dict_type_id");--> statement-breakpoint
CREATE INDEX "scheduled_task_runs_status_idx" ON "scheduled_task_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scheduled_task_runs_task_id_idx" ON "scheduled_task_runs" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "scheduled_tasks_is_active_idx" ON "scheduled_tasks" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "scheduled_tasks_next_run_at_idx" ON "scheduled_tasks" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "file_references_ref_idx" ON "file_references" USING btree ("ref_table","ref_id");--> statement-breakpoint
CREATE INDEX "files_sha256_idx" ON "files" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "files_created_at_idx" ON "files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_hash_idx" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_recovery_codes_user_id_idx" ON "user_recovery_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_tokens_token_hash_idx" ON "api_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "api_tokens_created_by_idx" ON "api_tokens" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_id_idx" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_due_idx" ON "webhook_deliveries" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "saved_queries_category_idx" ON "saved_queries" USING btree ("category");--> statement-breakpoint
CREATE INDEX "saved_queries_is_active_idx" ON "saved_queries" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "saved_queries_owner_idx" ON "saved_queries" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "saved_query_versions_query_id_idx" ON "saved_query_versions" USING btree ("query_id");--> statement-breakpoint
CREATE INDEX "ai_prompt_templates_category_idx" ON "ai_prompt_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ai_prompt_templates_name_idx" ON "ai_prompt_templates" USING btree ("name");