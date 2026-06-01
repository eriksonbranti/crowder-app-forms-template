CREATE TYPE "public"."group_scope" AS ENUM('transaction', 'item');--> statement-breakpoint
CREATE TYPE "public"."refund_reason" AS ENUM('user_request', 'cancelled_by_partner', 'chargeback', 'fraud', 'other');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('valid', 'reserved', 'expired', 'confirmed', 'refunded');--> statement-breakpoint
CREATE TABLE "form_versions" (
	"form_id" text NOT NULL,
	"version" integer NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"definition" jsonb NOT NULL,
	CONSTRAINT "form_versions_form_id_version_pk" PRIMARY KEY("form_id","version")
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"definition" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"theme" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_config" (
	"id" integer PRIMARY KEY NOT NULL,
	"crowder_api_key" text NOT NULL,
	"crowder_api_key_previous" text,
	"supported_currencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"protocol_versions" jsonb DEFAULT '["1.2"]'::jsonb NOT NULL,
	"allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"theme" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"edited_by" uuid NOT NULL,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	"answers_before" jsonb NOT NULL,
	"answers_after" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" text NOT NULL,
	"group_id" text NOT NULL,
	"form_version" integer NOT NULL,
	"transaction_id" text NOT NULL,
	"scope" "group_scope" NOT NULL,
	"item_uuid" text,
	"item_snapshot" jsonb,
	"holder_first_name" text,
	"holder_last_name" text,
	"holder_document" text,
	"answers" jsonb NOT NULL,
	"computed_label" text NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"status" "transaction_status" NOT NULL,
	"currency" text NOT NULL,
	"event_id" integer NOT NULL,
	"event_name" text NOT NULL,
	"locale" text,
	"user_snapshot" jsonb,
	"buyer_email" text,
	"buyer_first_name" text,
	"buyer_last_name" text,
	"expires_at" timestamp with time zone,
	"purchase_id" integer,
	"purchase_amount" double precision,
	"confirmed_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"refund_amount" double precision,
	"refund_reason" "refund_reason",
	"refund_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" text NOT NULL,
	"status" text NOT NULL,
	"payload" jsonb NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_edits" ADD CONSTRAINT "submission_edits_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_form_version_fk" FOREIGN KEY ("form_id","form_version") REFERENCES "public"."form_versions"("form_id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_versions_form_id_idx" ON "form_versions" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "submission_edits_submission_id_idx" ON "submission_edits" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_unique_item" ON "submissions" USING btree ("form_id","group_id","transaction_id","item_uuid") WHERE "submissions"."item_uuid" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_unique_transaction" ON "submissions" USING btree ("form_id","group_id","transaction_id") WHERE "submissions"."item_uuid" IS NULL;--> statement-breakpoint
CREATE INDEX "submissions_form_group_idx" ON "submissions" USING btree ("form_id","group_id");--> statement-breakpoint
CREATE INDEX "submissions_holder_document_idx" ON "submissions" USING btree ("holder_document");--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "submissions_holder_name_trgm_idx" ON "submissions" USING gin (lower(coalesce("holder_first_name", '') || ' ' || coalesce("holder_last_name", '')) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "transactions_status_idx" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transactions_status_expires_at_idx" ON "transactions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "transactions_created_at_idx" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transactions_buyer_email_idx" ON "transactions" USING btree (lower("buyer_email"));--> statement-breakpoint
CREATE INDEX "transactions_buyer_name_trgm_idx" ON "transactions" USING gin (lower(coalesce("buyer_first_name", '') || ' ' || coalesce("buyer_last_name", '')) gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_unique" ON "webhook_events" USING btree ("transaction_id","status");