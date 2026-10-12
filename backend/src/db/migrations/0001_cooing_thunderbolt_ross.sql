CREATE TYPE "public"."field_payment_method" AS ENUM('CASH', 'ESEWA', 'KHALTI', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."field_sale_status" AS ENUM('ACTIVE', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."field_seller_status" AS ENUM('ACTIVE', 'DISABLED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "field_sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"name_snapshot" text NOT NULL,
	"sku_snapshot" text NOT NULL,
	"unit_price_paisa" integer NOT NULL,
	"qty" integer NOT NULL,
	CONSTRAINT "field_sale_items_qty_chk" CHECK ("field_sale_items"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "field_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"field_seller_id" uuid NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"payment_method" "field_payment_method" DEFAULT 'CASH' NOT NULL,
	"total_paisa" bigint NOT NULL,
	"status" "field_sale_status" DEFAULT 'ACTIVE' NOT NULL,
	"void_reason" text,
	"voided_by_user_id" uuid,
	"voided_at" timestamp with time zone,
	"note" text,
	"sold_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "field_sales_void_reason_chk" CHECK ("field_sales"."status" <> 'VOIDED' OR "field_sales"."void_reason" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "field_sellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"phone" text,
	"status" "field_seller_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "field_sellers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "document_file_name" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "document_data" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "document_mime_type" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_sale_items" ADD CONSTRAINT "field_sale_items_sale_id_field_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."field_sales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_sale_items" ADD CONSTRAINT "field_sale_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_sales" ADD CONSTRAINT "field_sales_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_sales" ADD CONSTRAINT "field_sales_field_seller_id_field_sellers_id_fk" FOREIGN KEY ("field_seller_id") REFERENCES "public"."field_sellers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_sales" ADD CONSTRAINT "field_sales_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_sellers" ADD CONSTRAINT "field_sellers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_sellers" ADD CONSTRAINT "field_sellers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_sellers" ADD CONSTRAINT "field_sellers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "field_sale_items_sale_idx" ON "field_sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "field_sales_org_sold_idx" ON "field_sales" USING btree ("org_id","sold_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "field_sales_seller_sold_idx" ON "field_sales" USING btree ("field_seller_id","sold_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "field_sellers_org_idx" ON "field_sellers" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_login_identifier_chk" CHECK ("users"."email" IS NOT NULL OR "users"."username" IS NOT NULL);