CREATE TABLE "landing_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "landings" ADD COLUMN "group_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "landing_groups_name_lower_idx" ON "landing_groups" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "landings" ADD CONSTRAINT "landings_group_id_landing_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."landing_groups"("id") ON DELETE set null ON UPDATE no action;