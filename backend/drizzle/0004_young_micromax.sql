CREATE TYPE "public"."auth_token_type" AS ENUM('verification', 'password_reset');--> statement-breakpoint
CREATE TYPE "public"."conflict_resolution" AS ENUM('auto', 'ours', 'theirs', 'manual');--> statement-breakpoint
CREATE TYPE "public"."content_operation_type" AS ENUM('inherit', 'merge', 'rebase');--> statement-breakpoint
CREATE TYPE "public"."merge_state" AS ENUM('clean', 'conflict', 'resolved');--> statement-breakpoint
ALTER TYPE "public"."auth_provider" ADD VALUE 'email';--> statement-breakpoint
CREATE TABLE "content_merge_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid,
	"operation_type" "content_operation_type" NOT NULL,
	"source_branch_id" uuid,
	"target_branch_id" uuid,
	"base_version_id" uuid,
	"source_version_id" uuid,
	"result_version_id" uuid,
	"had_conflict" boolean DEFAULT false NOT NULL,
	"conflict_resolution" "conflict_resolution",
	"actor_id" uuid NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"commit_ref" text NOT NULL,
	"content_manifest" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_category_uniq" UNIQUE("user_id","category")
);
--> statement-breakpoint
CREATE TABLE "review_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"base_commit" varchar(40) NOT NULL,
	"head_commit" varchar(40) NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_snapshots_review_id_unique" UNIQUE("review_id")
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"turn_count" integer DEFAULT 0 NOT NULL,
	"max_turns" integer DEFAULT 20 NOT NULL,
	"end_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"content_id" uuid,
	"request_type" text NOT NULL,
	"prompt" text NOT NULL,
	"selected_text" text,
	"context_snapshot" text,
	"generated_content" text,
	"status" text DEFAULT 'generating' NOT NULL,
	"provider_id" text,
	"model_id" text,
	"tokens_used" integer,
	"error_message" text,
	"resolved_at" timestamp with time zone,
	"response_mode" text,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text DEFAULT 'global' NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_context_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"type" "auth_token_type" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "external_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "review_cycle" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "base_version_id" uuid;--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "merge_state" "merge_state" DEFAULT 'clean' NOT NULL;--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "conflict_data" jsonb;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "category" text NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "actor_id" uuid;--> statement-breakpoint
ALTER TABLE "content_merge_history" ADD CONSTRAINT "content_merge_history_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_merge_history" ADD CONSTRAINT "content_merge_history_source_branch_id_branches_id_fk" FOREIGN KEY ("source_branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_merge_history" ADD CONSTRAINT "content_merge_history_target_branch_id_branches_id_fk" FOREIGN KEY ("target_branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_merge_history" ADD CONSTRAINT "content_merge_history_base_version_id_content_versions_id_fk" FOREIGN KEY ("base_version_id") REFERENCES "public"."content_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_merge_history" ADD CONSTRAINT "content_merge_history_source_version_id_content_versions_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."content_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_merge_history" ADD CONSTRAINT "content_merge_history_result_version_id_content_versions_id_fk" FOREIGN KEY ("result_version_id") REFERENCES "public"."content_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_merge_history" ADD CONSTRAINT "content_merge_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_snapshots" ADD CONSTRAINT "content_snapshots_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_snapshots" ADD CONSTRAINT "review_snapshots_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_snapshots" ADD CONSTRAINT "review_snapshots_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_configurations" ADD CONSTRAINT "ai_configurations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_context_documents" ADD CONSTRAINT "ai_context_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_context_documents" ADD CONSTRAINT "ai_context_documents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cmh_content_id_idx" ON "content_merge_history" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "cmh_source_branch_idx" ON "content_merge_history" USING btree ("source_branch_id");--> statement-breakpoint
CREATE INDEX "cmh_target_branch_idx" ON "content_merge_history" USING btree ("target_branch_id");--> statement-breakpoint
CREATE INDEX "cmh_actor_id_idx" ON "content_merge_history" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "cmh_created_at_idx" ON "content_merge_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cs_branch_id_idx" ON "content_snapshots" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "cs_created_at_idx" ON "content_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notification_preferences_user_idx" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "review_snapshots_review_idx" ON "review_snapshots" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "review_snapshots_branch_idx" ON "review_snapshots" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "ai_conv_user_branch_idx" ON "ai_conversations" USING btree ("user_id","branch_id");--> statement-breakpoint
CREATE INDEX "ai_conv_session_idx" ON "ai_conversations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ai_conv_expires_idx" ON "ai_conversations" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_conv_active_unique" ON "ai_conversations" USING btree ("user_id","branch_id") WHERE "ai_conversations"."status" = 'active';--> statement-breakpoint
CREATE INDEX "ai_req_conversation_idx" ON "ai_requests" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "ai_req_user_branch_status_idx" ON "ai_requests" USING btree ("user_id","branch_id","status");--> statement-breakpoint
CREATE INDEX "ai_req_expires_idx" ON "ai_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ai_req_rate_limit_idx" ON "ai_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_config_scope_key_idx" ON "ai_configurations" USING btree ("scope","key");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_tokens_token_idx" ON "auth_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "auth_tokens_user_id_idx" ON "auth_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_tokens_expires_at_idx" ON "auth_tokens" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_category_idx" ON "notifications" USING btree ("user_id","category");