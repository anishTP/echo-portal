CREATE TYPE "public"."content_type" AS ENUM('guideline', 'asset', 'opinion');--> statement-breakpoint
CREATE TABLE "content_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_content_id" uuid NOT NULL,
	"source_version_id" uuid NOT NULL,
	"target_content_id" uuid NOT NULL,
	"target_version_id" uuid,
	"reference_type" text DEFAULT 'link' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"version_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"parent_version_id" uuid,
	"body" text NOT NULL,
	"body_format" text DEFAULT 'markdown' NOT NULL,
	"metadata_snapshot" jsonb NOT NULL,
	"change_description" text NOT NULL,
	"author_id" uuid NOT NULL,
	"author_type" "actor_type" DEFAULT 'user' NOT NULL,
	"byte_size" integer NOT NULL,
	"checksum" text NOT NULL,
	"is_revert" boolean DEFAULT false NOT NULL,
	"reverted_from_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content_type" "content_type" NOT NULL,
	"category" text,
	"tags" text[] DEFAULT '{}',
	"description" text,
	"current_version_id" uuid,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"published_version_id" uuid,
	"source_content_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"resource_type" text,
	"resource_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "content_references" ADD CONSTRAINT "content_references_source_content_id_contents_id_fk" FOREIGN KEY ("source_content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_references" ADD CONSTRAINT "content_references_source_version_id_content_versions_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."content_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_references" ADD CONSTRAINT "content_references_target_content_id_contents_id_fk" FOREIGN KEY ("target_content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_references" ADD CONSTRAINT "content_references_target_version_id_content_versions_id_fk" FOREIGN KEY ("target_version_id") REFERENCES "public"."content_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cr_version_target_type_idx" ON "content_references" USING btree ("source_version_id","target_content_id","reference_type");--> statement-breakpoint
CREATE INDEX "cr_source_content_idx" ON "content_references" USING btree ("source_content_id");--> statement-breakpoint
CREATE INDEX "cr_target_content_idx" ON "content_references" USING btree ("target_content_id");--> statement-breakpoint
CREATE INDEX "cr_source_version_idx" ON "content_references" USING btree ("source_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cv_content_timestamp_idx" ON "content_versions" USING btree ("content_id","version_timestamp");--> statement-breakpoint
CREATE INDEX "cv_content_id_idx" ON "content_versions" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "cv_version_timestamp_idx" ON "content_versions" USING btree ("version_timestamp");--> statement-breakpoint
CREATE INDEX "cv_author_id_idx" ON "content_versions" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contents_branch_slug_idx" ON "contents" USING btree ("branch_id","slug");--> statement-breakpoint
CREATE INDEX "contents_branch_id_idx" ON "contents" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "contents_content_type_idx" ON "contents" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "contents_is_published_idx" ON "contents" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "contents_created_by_idx" ON "contents" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "contents_source_content_id_idx" ON "contents" USING btree ("source_content_id");--> statement-breakpoint
CREATE INDEX "contents_branch_type_idx" ON "contents" USING btree ("branch_id","content_type");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");