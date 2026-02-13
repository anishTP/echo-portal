-- Add category and actor_id columns to notifications table
ALTER TABLE "notifications" ADD COLUMN "category" text NOT NULL DEFAULT 'review';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "actor_id" uuid;--> statement-breakpoint

-- Backfill category for existing notifications based on type
UPDATE "notifications" SET "category" = CASE
  WHEN "type" LIKE 'review_%' THEN 'review'
  WHEN "type" IN ('changes_requested') THEN 'review'
  WHEN "type" IN ('content_published', 'collaborator_added', 'collaborator_removed', 'branch_archived', 'role_changed') THEN 'lifecycle'
  WHEN "type" IN ('ai_compliance_error') THEN 'ai'
  ELSE 'review'
END;--> statement-breakpoint

-- Remove the default after backfill (column is NOT NULL, new inserts must provide category)
ALTER TABLE "notifications" ALTER COLUMN "category" DROP DEFAULT;--> statement-breakpoint

-- Add FK constraint for actor_id
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Add index for category-filtered queries
CREATE INDEX "notifications_user_category_idx" ON "notifications" USING btree ("user_id","category");--> statement-breakpoint

-- Create notification_preferences table
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Add constraints and indexes for notification_preferences
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_category_uniq" UNIQUE("user_id","category");--> statement-breakpoint
CREATE INDEX "notification_preferences_user_idx" ON "notification_preferences" USING btree ("user_id");
