CREATE TYPE "public"."day_plan_status" AS ENUM('planned', 'in_progress', 'closed', 'reconciled');--> statement-breakpoint
CREATE TYPE "public"."expense_type" AS ENUM('salary', 'fuel', 'khaja', 'miscellaneous');--> statement-breakpoint
CREATE TYPE "public"."loss_reason" AS ENUM('damaged', 'expired', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_image_kind" AS ENUM('cheque_front', 'cheque_back', 'online_screenshot', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'cheque', 'online');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'confirmed', 'bounced');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'manager', 'salesman');--> statement-breakpoint
CREATE TYPE "public"."visit_status" AS ENUM('planned', 'visited', 'skipped');--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"pan_number" text NOT NULL,
	"registration_number" text,
	"phone" text NOT NULL,
	"email" text,
	"address" text NOT NULL,
	"city" text,
	"logo_key" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "businesses_pan_number_unique" UNIQUE("pan_number")
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"brand" text,
	"sku" text,
	"barcode" text,
	"image_key" text,
	"unit" text DEFAULT 'piece' NOT NULL,
	"units_per_carton" integer,
	"price_paisa" bigint NOT NULL,
	"carton_price_paisa" bigint,
	"mrp_paisa" bigint,
	"cost_price_paisa" bigint,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_alert" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retail_clients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"owner_name" text,
	"phone" text,
	"address" text,
	"pan_number" text,
	"pan_card_image_key" text,
	"registration_number" text,
	"lat" double precision,
	"lng" double precision,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"last_login_at" timestamp with time zone,
	"credit_limit_paisa" bigint DEFAULT 0 NOT NULL,
	"opening_balance_paisa" bigint DEFAULT 0 NOT NULL,
	"linked_business_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "retail_clients_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "route_clients" (
	"route_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_plan_stock" (
	"id" uuid PRIMARY KEY NOT NULL,
	"day_plan_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"unit" text NOT NULL,
	"quantity_issued" integer NOT NULL,
	"quantity_returned" integer,
	"quantity_counted" integer
);
--> statement-breakpoint
CREATE TABLE "day_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"salesman_id" uuid NOT NULL,
	"route_id" uuid NOT NULL,
	"plan_date" date NOT NULL,
	"assigned_by" uuid NOT NULL,
	"status" "day_plan_status" DEFAULT 'planned' NOT NULL,
	"started_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"cash_handed_over_paisa" bigint,
	"reconciled_by" uuid,
	"reconciled_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visit_photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"visit_id" uuid NOT NULL,
	"image_key" text NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"note" text,
	"exif_taken_at" timestamp with time zone,
	"image_hash" text NOT NULL,
	"distance_from_shop_m" integer,
	"flag_reason" text,
	CONSTRAINT "visit_photos_image_hash_unique" UNIQUE("image_hash")
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"day_plan_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"status" "visit_status" DEFAULT 'planned' NOT NULL,
	"visited_at" timestamp with time zone,
	"lat" double precision,
	"lng" double precision,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "invoice_counters" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_images" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"kind" "payment_image_kind" NOT NULL,
	"image_key" text NOT NULL,
	"image_hash" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"uploaded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payment_images_image_hash_unique" UNIQUE("image_hash")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"sale_id" uuid,
	"day_plan_id" uuid,
	"collected_by" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'confirmed' NOT NULL,
	"amount_paisa" bigint NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"cheque_number" text,
	"cheque_bank" text,
	"cheque_date" date,
	"reference_no" text,
	"note" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_paisa" bigint NOT NULL,
	"line_total_paisa" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"salesman_id" uuid NOT NULL,
	"day_plan_id" uuid NOT NULL,
	"visit_id" uuid,
	"invoice_number" integer NOT NULL,
	"sale_date" date NOT NULL,
	"due_date" date,
	"discount_paisa" bigint DEFAULT 0 NOT NULL,
	"total_paisa" bigint NOT NULL,
	"status" "sale_status" DEFAULT 'confirmed' NOT NULL,
	"cancel_reason" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"type" "expense_type" NOT NULL,
	"amount_paisa" bigint NOT NULL,
	"expense_date" date NOT NULL,
	"user_id" uuid,
	"day_plan_id" uuid,
	"for_month" date,
	"description" text,
	"receipt_key" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_return_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sale_return_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_paisa" bigint NOT NULL,
	"line_total_paisa" bigint NOT NULL,
	"reason" "loss_reason" NOT NULL,
	"restocked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_returns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"sale_id" uuid,
	"day_plan_id" uuid,
	"received_by" uuid NOT NULL,
	"return_date" date NOT NULL,
	"total_paisa" bigint NOT NULL,
	"note" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_write_offs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"unit" text NOT NULL,
	"quantity" integer NOT NULL,
	"reason" "loss_reason" NOT NULL,
	"cost_value_paisa" bigint,
	"write_off_date" date NOT NULL,
	"day_plan_id" uuid,
	"recorded_by" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retail_clients" ADD CONSTRAINT "retail_clients_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retail_clients" ADD CONSTRAINT "retail_clients_linked_business_id_businesses_id_fk" FOREIGN KEY ("linked_business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_clients" ADD CONSTRAINT "route_clients_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_clients" ADD CONSTRAINT "route_clients_client_id_retail_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."retail_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_plan_stock" ADD CONSTRAINT "day_plan_stock_day_plan_id_day_plans_id_fk" FOREIGN KEY ("day_plan_id") REFERENCES "public"."day_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_plan_stock" ADD CONSTRAINT "day_plan_stock_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_plans" ADD CONSTRAINT "day_plans_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_plans" ADD CONSTRAINT "day_plans_salesman_id_users_id_fk" FOREIGN KEY ("salesman_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_plans" ADD CONSTRAINT "day_plans_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_plans" ADD CONSTRAINT "day_plans_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_plans" ADD CONSTRAINT "day_plans_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_photos" ADD CONSTRAINT "visit_photos_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_day_plan_id_day_plans_id_fk" FOREIGN KEY ("day_plan_id") REFERENCES "public"."day_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_client_id_retail_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."retail_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_counters" ADD CONSTRAINT "invoice_counters_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_images" ADD CONSTRAINT "payment_images_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_images" ADD CONSTRAINT "payment_images_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_retail_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."retail_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_day_plan_id_day_plans_id_fk" FOREIGN KEY ("day_plan_id") REFERENCES "public"."day_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_collected_by_users_id_fk" FOREIGN KEY ("collected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_retail_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."retail_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_salesman_id_users_id_fk" FOREIGN KEY ("salesman_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_day_plan_id_day_plans_id_fk" FOREIGN KEY ("day_plan_id") REFERENCES "public"."day_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_day_plan_id_day_plans_id_fk" FOREIGN KEY ("day_plan_id") REFERENCES "public"."day_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_sale_return_id_sale_returns_id_fk" FOREIGN KEY ("sale_return_id") REFERENCES "public"."sale_returns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_client_id_retail_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."retail_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_day_plan_id_day_plans_id_fk" FOREIGN KEY ("day_plan_id") REFERENCES "public"."day_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_write_offs" ADD CONSTRAINT "stock_write_offs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_write_offs" ADD CONSTRAINT "stock_write_offs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_write_offs" ADD CONSTRAINT "stock_write_offs_day_plan_id_day_plans_id_fk" FOREIGN KEY ("day_plan_id") REFERENCES "public"."day_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_write_offs" ADD CONSTRAINT "stock_write_offs_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_categories_business_name" ON "product_categories" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "idx_users_business_role" ON "users" USING btree ("business_id","role");--> statement-breakpoint
CREATE INDEX "idx_products_business_active" ON "products" USING btree ("business_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_products_category" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_products_business_sku" ON "products" USING btree ("business_id","sku");--> statement-breakpoint
CREATE INDEX "idx_retail_clients_business" ON "retail_clients" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_retail_clients_business_pan" ON "retail_clients" USING btree ("business_id","pan_number");--> statement-breakpoint
CREATE UNIQUE INDEX "route_clients_pkey" ON "route_clients" USING btree ("route_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_routes_business_name" ON "routes" USING btree ("business_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_day_plan_stock_plan_product_unit" ON "day_plan_stock" USING btree ("day_plan_id","product_id","unit");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_day_plans_salesman_route_date" ON "day_plans" USING btree ("salesman_id","route_id","plan_date");--> statement-breakpoint
CREATE INDEX "idx_day_plans_salesman_date" ON "day_plans" USING btree ("salesman_id","plan_date");--> statement-breakpoint
CREATE INDEX "idx_visit_photos_visit" ON "visit_photos" USING btree ("visit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_visits_day_plan_client" ON "visits" USING btree ("day_plan_id","client_id");--> statement-breakpoint
CREATE INDEX "idx_payment_images_payment" ON "payment_images" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_payments_client_received" ON "payments" USING btree ("client_id","received_at");--> statement-breakpoint
CREATE INDEX "idx_payments_day_plan" ON "payments" USING btree ("day_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payments_business_idempotency" ON "payments" USING btree ("business_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_sale_items_sale" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "idx_sale_items_product" ON "sale_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_sales_client_date" ON "sales" USING btree ("client_id","sale_date");--> statement-breakpoint
CREATE INDEX "idx_sales_salesman_date" ON "sales" USING btree ("salesman_id","sale_date");--> statement-breakpoint
CREATE INDEX "idx_sales_day_plan" ON "sales" USING btree ("day_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sales_business_idempotency" ON "sales" USING btree ("business_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sales_business_invoice" ON "sales" USING btree ("business_id","invoice_number");--> statement-breakpoint
CREATE INDEX "idx_expenses_business_date" ON "expenses" USING btree ("business_id","expense_date");--> statement-breakpoint
CREATE INDEX "idx_expenses_user_date" ON "expenses" USING btree ("user_id","expense_date");--> statement-breakpoint
CREATE INDEX "idx_sale_return_items_return" ON "sale_return_items" USING btree ("sale_return_id");--> statement-breakpoint
CREATE INDEX "idx_sale_returns_client_date" ON "sale_returns" USING btree ("client_id","return_date");--> statement-breakpoint
CREATE INDEX "idx_sale_returns_day_plan" ON "sale_returns" USING btree ("day_plan_id");--> statement-breakpoint
CREATE INDEX "idx_stock_write_offs_business_date" ON "stock_write_offs" USING btree ("business_id","write_off_date");--> statement-breakpoint
CREATE INDEX "idx_stock_write_offs_day_plan" ON "stock_write_offs" USING btree ("day_plan_id");