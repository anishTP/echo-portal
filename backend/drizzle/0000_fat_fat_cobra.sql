CREATE TYPE "public"."actor_type" AS ENUM('user', 'system');--> statement-breakpoint
CREATE TYPE "public"."audit_outcome" AS ENUM('success', 'failure', 'denied');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('github', 'google', 'saml', 'api_token');--> statement-breakpoint
CREATE TYPE "public"."branch_state" AS ENUM('draft', 'review', 'approved', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."convergence_status" AS ENUM('pending', 'validating', 'merging', 'succeeded', 'failed', 'rolled_back');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('approved', 'changes_requested');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('viewer', 'contributor', 'reviewer', 'administrator');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('private', 'team', 'public');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"roles" "role"[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"locked_until" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"last_failed_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"git_ref" text NOT NULL,
	"base_ref" text NOT NULL,
	"base_commit" text NOT NULL,
	"head_commit" text NOT NULL,
	"state" "branch_state" DEFAULT 'draft' NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"owner_id" uuid NOT NULL,
	"reviewers" uuid[] DEFAULT '{}',
	"collaborators" uuid[] DEFAULT '{}',
	"assigned_reviewers" uuid[] DEFAULT '{}',
	"required_approvals" integer DEFAULT 1 NOT NULL,
	"description" text,
	"labels" text[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	CONSTRAINT "branches_slug_unique" UNIQUE("slug"),
	CONSTRAINT "branches_git_ref_unique" UNIQUE("git_ref")
);
--> statement-breakpoint
CREATE TABLE "branch_state_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"from_state" "branch_state" NOT NULL,
	"to_state" "branch_state" NOT NULL,
	"actor_id" text NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"decision" "review_decision",
	"comments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "convergence_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"publisher_id" uuid NOT NULL,
	"status" "convergence_status" DEFAULT 'pending' NOT NULL,
	"validation_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conflict_detected" boolean DEFAULT false NOT NULL,
	"conflict_details" jsonb,
	"merge_commit" text,
	"target_ref" text DEFAULT 'main' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_ip" text,
	"actor_user_agent" text,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"outcome" "audit_outcome",
	"initiating_user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"request_id" text,
	"session_id" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"provider" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"provider" text NOT NULL,
	"success" boolean NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"failure_reason" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_state_transitions" ADD CONSTRAINT "branch_state_transitions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convergence_operations" ADD CONSTRAINT "convergence_operations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convergence_operations" ADD CONSTRAINT "convergence_operations_publisher_id_users_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branches_owner_id_idx" ON "branches" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "branches_state_idx" ON "branches" USING btree ("state");--> statement-breakpoint
CREATE INDEX "branches_visibility_idx" ON "branches" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "branches_updated_at_idx" ON "branches" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "branches_state_visibility_idx" ON "branches" USING btree ("state","visibility");--> statement-breakpoint
CREATE INDEX "branches_base_ref_idx" ON "branches" USING btree ("base_ref");--> statement-breakpoint
CREATE INDEX "branch_transitions_branch_id_idx" ON "branch_state_transitions" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "branch_transitions_created_at_idx" ON "branch_state_transitions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reviews_branch_id_idx" ON "reviews" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "reviews_reviewer_id_idx" ON "reviews" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reviews_reviewer_status_idx" ON "reviews" USING btree ("reviewer_id","status");--> statement-breakpoint
CREATE INDEX "convergence_branch_id_idx" ON "convergence_operations" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "convergence_status_idx" ON "convergence_operations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "convergence_publisher_id_idx" ON "convergence_operations" USING btree ("publisher_id");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_timestamp_idx" ON "audit_logs" USING btree ("resource_type","resource_id","timestamp");--> statement-breakpoint
CREATE INDEX "audit_logs_action_timestamp_idx" ON "audit_logs" USING btree ("action","timestamp");--> statement-breakpoint
CREATE INDEX "audit_logs_outcome_timestamp_idx" ON "audit_logs" USING btree ("outcome","timestamp");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_action_idx" ON "audit_logs" USING btree ("actor_id","action");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_outcome_idx" ON "audit_logs" USING btree ("actor_id","outcome");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_last_activity_at_idx" ON "sessions" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "login_attempts_email_idx" ON "login_attempts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "login_attempts_attempted_at_idx" ON "login_attempts" USING btree ("attempted_at");--> statement-breakpoint
CREATE INDEX "login_attempts_email_success_idx" ON "login_attempts" USING btree ("email","success");