DO $$ BEGIN
 CREATE TYPE "public"."catalog_source" AS ENUM('manual', 'shopify', 'vtex');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."provider" AS ENUM('shopify', 'vtex');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalogs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"source" "catalog_source" NOT NULL,
	"credential_id" uuid,
	"currency" text,
	"sync_state" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collections" (
	"id" text PRIMARY KEY NOT NULL,
	"catalog_id" text NOT NULL,
	"title" text NOT NULL,
	"external_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_id" text NOT NULL,
	"external_id" text,
	"title" text NOT NULL,
	"currency" text,
	"image_url" text,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"refundable" boolean DEFAULT true NOT NULL,
	"options" jsonb,
	"variants" jsonb NOT NULL,
	"collection_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raw" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "provider" NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"secret" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "partner_config" ADD COLUMN IF NOT EXISTS "enabled_providers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "partner_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "catalogs" ADD CONSTRAINT "catalogs_credential_id_provider_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."provider_credentials"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collections" ADD CONSTRAINT "collections_catalog_id_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."catalogs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_catalog_id_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."catalogs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collections_catalog_id_idx" ON "collections" USING btree ("catalog_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "collections_catalog_external_idx" ON "collections" USING btree ("catalog_id","external_id") WHERE "collections"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_catalog_id_idx" ON "products" USING btree ("catalog_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_catalog_external_idx" ON "products" USING btree ("catalog_id","external_id") WHERE "products"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_collection_ids_idx" ON "products" USING gin ("collection_ids");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_reservations_txn_product_variant_idx" ON "stock_reservations" USING btree ("transaction_id","product_id","variant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_reservations_variant_held_idx" ON "stock_reservations" USING btree ("variant_id") WHERE "stock_reservations"."status" = 'held';--> statement-breakpoint
-- Semilla del singleton partner_config con las monedas LATAM por defecto
-- (DEFAULT_CURRENCY_CODES en src/lib/products/currencies.ts). Así los selectores
-- de moneda del dashboard nacen poblados sin depender de que el partner entre a
-- Settings. ON CONFLICT DO NOTHING: no pisa una config existente.
INSERT INTO "partner_config" ("id", "supported_currencies")
VALUES (1, '["ARS","CLP","BRL","PEN","COP","MXN","USD"]'::jsonb)
ON CONFLICT ("id") DO NOTHING;