CREATE TABLE "landings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"theme_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"slides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cta_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "landings_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slug_redirects" (
	"old_slug" text PRIMARY KEY NOT NULL,
	"landing_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "slug_redirects" ADD CONSTRAINT "slug_redirects_landing_id_landings_id_fk" FOREIGN KEY ("landing_id") REFERENCES "public"."landings"("id") ON DELETE cascade ON UPDATE no action;