CREATE TYPE "public"."content_section" AS ENUM('brand', 'product', 'experience');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"section" "content_section" NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "section" "content_section";--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_section_name_uniq" ON "categories" USING btree ("section","name");--> statement-breakpoint
CREATE INDEX "categories_section_idx" ON "categories" USING btree ("section");--> statement-breakpoint
CREATE INDEX "contents_section_idx" ON "contents" USING btree ("section");