CREATE TABLE "images" (
	"id" uuid PRIMARY KEY NOT NULL,
	"file" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
