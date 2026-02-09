CREATE TYPE "public"."ai_recommendation_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ai_recommendation_type" AS ENUM('pm_schedule', 'parts_order', 'work_order');--> statement-breakpoint
CREATE TYPE "public"."asset_level" AS ENUM('site', 'area', 'line', 'equipment', 'component');--> statement-breakpoint
CREATE TYPE "public"."break_reason" AS ENUM('lunch', 'parts_wait', 'meeting', 'personal', 'other');--> statement-breakpoint
CREATE TYPE "public"."form_archetype" AS ENUM('data_table', 'calculation', 'planning', 'document', 'evidence');--> statement-breakpoint
CREATE TYPE "public"."interview_role" AS ENUM('technician', 'supervisor', 'manager', 'planner', 'storeroom', 'operations', 'other');--> statement-breakpoint
CREATE TYPE "public"."onboarding_stage" AS ENUM('not_started', 'company_created', 'plan_selected', 'pending_payment', 'payment_complete', 'completed');--> statement-breakpoint
CREATE TYPE "public"."package_type" AS ENUM('full_access', 'operations', 'demo');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('platform_admin', 'customer_user');--> statement-breakpoint
CREATE TYPE "public"."time_entry_type" AS ENUM('work', 'break');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'tech');--> statement-breakpoint
CREATE TYPE "public"."work_order_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('draft', 'pending_approval', 'open', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."work_order_type" AS ENUM('corrective', 'preventive', 'inspection');--> statement-breakpoint
CREATE TABLE "access_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(50) NOT NULL,
	"created_by_id" varchar,
	"used_by_id" varchar,
	"used_at" timestamp,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "access_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "ai_recommendations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"equipment_id" varchar,
	"recommendation_type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"priority" varchar(50),
	"estimated_impact" text,
	"status" varchar(50) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"icon_url" varchar(500),
	"criteria" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"certificate_name" varchar(255),
	"issued_by" varchar(255),
	"issued_date" timestamp,
	"expiry_date" timestamp,
	"certificate_url" varchar(500),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"industry" varchar(100),
	"location" varchar(255),
	"contact_name" varchar(255),
	"contact_email" varchar(255),
	"notes" text,
	"created_by_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"license_count" integer DEFAULT 0,
	"used_licenses" integer DEFAULT 0,
	"package_type" "package_type" DEFAULT 'demo',
	"is_live" boolean DEFAULT false,
	"demo_expires_at" timestamp,
	"enabled_modules" jsonb DEFAULT '[]'::jsonb,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"stripe_manager_item_id" varchar,
	"stripe_tech_item_id" varchar,
	"subscription_status" varchar,
	"purchased_manager_seats" integer DEFAULT 0,
	"purchased_tech_seats" integer DEFAULT 0,
	"payment_restricted" boolean DEFAULT false,
	"onboarding_completed" boolean DEFAULT false,
	"onboarding_stage" "onboarding_stage" DEFAULT 'not_started',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "downtime_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"equipment_id" varchar NOT NULL,
	"work_order_id" varchar,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration_minutes" integer,
	"category" varchar(100),
	"root_cause" text,
	"impact" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "downtime_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"created_by_id" varchar,
	"file_name" varchar(255),
	"file_type" varchar(50),
	"record_count" integer,
	"total_downtime_hours" real,
	"analysis_data" jsonb,
	"archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"asset_tag" varchar(100),
	"equipment_type" varchar(255),
	"description" text,
	"manufacturer" varchar(255),
	"model" varchar(255),
	"serial_number" varchar(255),
	"location" varchar(255),
	"parent_equipment_id" varchar,
	"hierarchy_path" text,
	"asset_level" "asset_level" DEFAULT 'equipment',
	"level" "asset_level" DEFAULT 'equipment',
	"category" varchar(100),
	"criticality_score" integer,
	"commissioned_date" timestamp,
	"warranty_expiry_date" timestamp,
	"status" varchar(50) DEFAULT 'active',
	"notes" text,
	"manual_url" text,
	"qr_code" text,
	"photo_urls" jsonb DEFAULT '[]'::jsonb,
	"image_url" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equipment_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"title" varchar(255) NOT NULL,
	"document_type" varchar(100),
	"file_url" varchar(500) NOT NULL,
	"uploaded_by_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "excellence_deliverables" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"progress_id" varchar,
	"company_id" varchar NOT NULL,
	"step" integer NOT NULL,
	"checklist_item_id" varchar(100) NOT NULL,
	"deliverable_type" varchar(100),
	"title" varchar(255),
	"description" text,
	"payload" jsonb,
	"is_complete" boolean DEFAULT false,
	"completed_at" timestamp,
	"completed_by_id" varchar,
	"last_edited_by_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "excellence_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"current_step" integer DEFAULT 1,
	"step1_completed" boolean DEFAULT false,
	"step1_completed_at" timestamp,
	"step1_notes" text,
	"step1_checklist" jsonb DEFAULT '{}'::jsonb,
	"step1_progress" integer DEFAULT 0,
	"step1_deliverables" jsonb DEFAULT '[]'::jsonb,
	"step2_completed" boolean DEFAULT false,
	"step2_completed_at" timestamp,
	"step2_notes" text,
	"step2_checklist" jsonb DEFAULT '{}'::jsonb,
	"step2_progress" integer DEFAULT 0,
	"step2_deliverables" jsonb DEFAULT '[]'::jsonb,
	"step3_completed" boolean DEFAULT false,
	"step3_completed_at" timestamp,
	"step3_notes" text,
	"step3_checklist" jsonb DEFAULT '{}'::jsonb,
	"step3_progress" integer DEFAULT 0,
	"step3_deliverables" jsonb DEFAULT '[]'::jsonb,
	"step4_completed" boolean DEFAULT false,
	"step4_completed_at" timestamp,
	"step4_notes" text,
	"step4_checklist" jsonb DEFAULT '{}'::jsonb,
	"step4_progress" integer DEFAULT 0,
	"step4_deliverables" jsonb DEFAULT '[]'::jsonb,
	"step5_completed" boolean DEFAULT false,
	"step5_completed_at" timestamp,
	"step5_notes" text,
	"step5_checklist" jsonb DEFAULT '{}'::jsonb,
	"step5_progress" integer DEFAULT 0,
	"step5_deliverables" jsonb DEFAULT '[]'::jsonb,
	"step6_completed" boolean DEFAULT false,
	"step6_completed_at" timestamp,
	"step6_notes" text,
	"step6_checklist" jsonb DEFAULT '{}'::jsonb,
	"step6_progress" integer DEFAULT 0,
	"step6_deliverables" jsonb DEFAULT '[]'::jsonb,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "form_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"archetype" "form_archetype" NOT NULL,
	"schema" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "form_definitions_form_type_unique" UNIQUE("form_type")
);
--> statement-breakpoint
CREATE TABLE "integration_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" varchar NOT NULL,
	"action" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"details" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'active',
	"config" jsonb,
	"api_key" text,
	"webhook_url" text,
	"webhook_secret" text,
	"last_sync_at" timestamp,
	"last_sync_status" varchar(50),
	"sync_frequency_minutes" integer,
	"is_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"client_company_id" varchar,
	"assessment_deliverable_id" varchar,
	"interviewee_role" "interview_role" NOT NULL,
	"interviewee_name" varchar(255),
	"interviewee_department" varchar(255),
	"consent_given" boolean DEFAULT false,
	"audio_object_key" varchar(500),
	"transcript" text,
	"summary" text,
	"pain_points" jsonb DEFAULT '[]'::jsonb,
	"themes" jsonb DEFAULT '[]'::jsonb,
	"questions_asked" jsonb DEFAULT '[]'::jsonb,
	"duration" integer,
	"conducted_by_id" varchar,
	"conducted_at" timestamp,
	"transcribed_at" timestamp,
	"summarized_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'tech',
	"invited_by" varchar,
	"token" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"part_number" varchar(100) NOT NULL,
	"name" varchar(255),
	"description" text,
	"machine_type" varchar(255),
	"stock_level" integer DEFAULT 0,
	"min_stock_level" integer DEFAULT 0,
	"unit_cost" real,
	"location" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pm_required_parts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pm_schedule_id" varchar NOT NULL,
	"part_id" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pm_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"equipment_id" varchar,
	"name" varchar(255) NOT NULL,
	"description" text,
	"frequency_days" integer,
	"last_completed_date" timestamp,
	"next_due_date" timestamp,
	"measurements" text,
	"instructions" text,
	"optimization_suggestions" jsonb,
	"ai_analysis" jsonb,
	"imported_from" varchar(255),
	"last_optimized" timestamp,
	"is_optimized" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pm_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pm_schedule_id" varchar NOT NULL,
	"task_number" integer NOT NULL,
	"description" text NOT NULL,
	"estimated_minutes" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rca_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"equipment_id" varchar,
	"work_order_id" varchar,
	"created_by_id" varchar,
	"problem_statement" text NOT NULL,
	"five_whys" jsonb DEFAULT '[]'::jsonb,
	"fishbone_diagram" jsonb,
	"root_causes" jsonb DEFAULT '[]'::jsonb,
	"corrective_actions" jsonb DEFAULT '[]'::jsonb,
	"ai_insights" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "schematic_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schematic_id" varchar,
	"user_id" varchar,
	"completed_steps" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "schematics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"equipment_id" varchar,
	"name" varchar(255) NOT NULL,
	"image_url" varchar(500),
	"parts" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signup_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"access_key_id" varchar,
	"rejected_reason" text,
	"created_at" timestamp DEFAULT now(),
	"approved_at" timestamp,
	"rejected_at" timestamp,
	CONSTRAINT "signup_requests_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "stripe_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "stripe_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" varchar NOT NULL,
	"user_id" varchar,
	"company_id" varchar,
	"entry_type" varchar(20) DEFAULT 'work',
	"break_reason" varchar(50),
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration_minutes" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "training_modules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"content" text,
	"duration_minutes" integer,
	"quiz" jsonb DEFAULT '[]'::jsonb,
	"passing_score" integer DEFAULT 80,
	"points" integer DEFAULT 0,
	"cover_image" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "training_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"module_id" varchar,
	"completed" boolean DEFAULT false,
	"score" integer,
	"attempts" integer DEFAULT 0,
	"points_earned" integer DEFAULT 0,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "troubleshooting_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"equipment_id" varchar,
	"created_by_id" varchar,
	"current_step" integer DEFAULT 1,
	"step1_data" jsonb,
	"step2_data" jsonb,
	"step3_data" jsonb,
	"step4_data" jsonb,
	"step5_data" jsonb,
	"step6_data" jsonb,
	"ai_conversation" jsonb DEFAULT '[]'::jsonb,
	"completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"badge_id" varchar,
	"awarded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"first_name" varchar(255),
	"last_name" varchar(255),
	"profile_image_url" varchar(500),
	"company_id" varchar,
	"role" "user_role" DEFAULT 'tech',
	"department" varchar(255),
	"platform_role" "platform_role" DEFAULT 'customer_user',
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "work_order_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"name" varchar(255),
	"title_pattern" varchar(255),
	"description_template" text,
	"default_type" "work_order_type" DEFAULT 'preventive',
	"default_priority" "work_order_priority" DEFAULT 'medium',
	"default_duration" integer,
	"required_parts" jsonb DEFAULT '[]'::jsonb,
	"is_system_template" boolean DEFAULT false,
	"created_by_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_number" integer NOT NULL,
	"company_id" varchar NOT NULL,
	"equipment_id" varchar,
	"assigned_to_id" varchar,
	"created_by_id" varchar,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "work_order_status" DEFAULT 'draft',
	"priority" "work_order_priority" DEFAULT 'medium',
	"type" "work_order_type" DEFAULT 'corrective',
	"due_date" timestamp,
	"completed_at" timestamp,
	"notes" text,
	"photo_urls" jsonb DEFAULT '[]'::jsonb,
	"measurements" jsonb,
	"parts_used" jsonb DEFAULT '[]'::jsonb,
	"total_time_minutes" real,
	"timer_started_at" timestamp,
	"rca_id" varchar,
	"active_time_entry_id" varchar,
	"active_timer_type" time_entry_type,
	"submitted_by_id" varchar,
	"approved_by_id" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "access_keys" ADD CONSTRAINT "access_keys_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_keys" ADD CONSTRAINT "access_keys_used_by_id_users_id_fk" FOREIGN KEY ("used_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_companies" ADD CONSTRAINT "client_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_companies" ADD CONSTRAINT "client_companies_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_records" ADD CONSTRAINT "downtime_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_records" ADD CONSTRAINT "downtime_records_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_records" ADD CONSTRAINT "downtime_records_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_reports" ADD CONSTRAINT "downtime_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_reports" ADD CONSTRAINT "downtime_reports_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_parent_equipment_id_equipment_id_fk" FOREIGN KEY ("parent_equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_documents" ADD CONSTRAINT "equipment_documents_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_documents" ADD CONSTRAINT "equipment_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_documents" ADD CONSTRAINT "equipment_documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excellence_deliverables" ADD CONSTRAINT "excellence_deliverables_progress_id_excellence_progress_id_fk" FOREIGN KEY ("progress_id") REFERENCES "public"."excellence_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excellence_deliverables" ADD CONSTRAINT "excellence_deliverables_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excellence_deliverables" ADD CONSTRAINT "excellence_deliverables_completed_by_id_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excellence_deliverables" ADD CONSTRAINT "excellence_deliverables_last_edited_by_id_users_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excellence_progress" ADD CONSTRAINT "excellence_progress_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_logs" ADD CONSTRAINT "integration_logs_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_client_company_id_client_companies_id_fk" FOREIGN KEY ("client_company_id") REFERENCES "public"."client_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_assessment_deliverable_id_excellence_deliverables_id_fk" FOREIGN KEY ("assessment_deliverable_id") REFERENCES "public"."excellence_deliverables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_conducted_by_id_users_id_fk" FOREIGN KEY ("conducted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_required_parts" ADD CONSTRAINT "pm_required_parts_pm_schedule_id_pm_schedules_id_fk" FOREIGN KEY ("pm_schedule_id") REFERENCES "public"."pm_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_required_parts" ADD CONSTRAINT "pm_required_parts_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_schedules" ADD CONSTRAINT "pm_schedules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_schedules" ADD CONSTRAINT "pm_schedules_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_tasks" ADD CONSTRAINT "pm_tasks_pm_schedule_id_pm_schedules_id_fk" FOREIGN KEY ("pm_schedule_id") REFERENCES "public"."pm_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rca_records" ADD CONSTRAINT "rca_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rca_records" ADD CONSTRAINT "rca_records_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rca_records" ADD CONSTRAINT "rca_records_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rca_records" ADD CONSTRAINT "rca_records_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schematic_progress" ADD CONSTRAINT "schematic_progress_schematic_id_schematics_id_fk" FOREIGN KEY ("schematic_id") REFERENCES "public"."schematics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schematic_progress" ADD CONSTRAINT "schematic_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schematics" ADD CONSTRAINT "schematics_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schematics" ADD CONSTRAINT "schematics_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_requests" ADD CONSTRAINT "signup_requests_access_key_id_access_keys_id_fk" FOREIGN KEY ("access_key_id") REFERENCES "public"."access_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_modules" ADD CONSTRAINT "training_modules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_progress" ADD CONSTRAINT "training_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_progress" ADD CONSTRAINT "training_progress_module_id_training_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."training_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "troubleshooting_sessions" ADD CONSTRAINT "troubleshooting_sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "troubleshooting_sessions" ADD CONSTRAINT "troubleshooting_sessions_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "troubleshooting_sessions" ADD CONSTRAINT "troubleshooting_sessions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_templates" ADD CONSTRAINT "work_order_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_templates" ADD CONSTRAINT "work_order_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_rca_id_rca_records_id_fk" FOREIGN KEY ("rca_id") REFERENCES "public"."rca_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_active_time_entry_id_time_entries_id_fk" FOREIGN KEY ("active_time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_downtime_records_company" ON "downtime_records" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "IDX_downtime_records_equipment" ON "downtime_records" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "IDX_downtime_records_start_time" ON "downtime_records" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "IDX_equipment_company" ON "equipment" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "IDX_equipment_parent" ON "equipment" USING btree ("parent_equipment_id");--> statement-breakpoint
CREATE INDEX "IDX_equipment_asset_tag" ON "equipment" USING btree ("asset_tag");--> statement-breakpoint
CREATE INDEX "IDX_invitations_email" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "IDX_invitations_company" ON "invitations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "IDX_parts_company" ON "parts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "IDX_parts_part_number" ON "parts" USING btree ("part_number");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "IDX_users_company" ON "users" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "IDX_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "IDX_work_orders_company" ON "work_orders" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "IDX_work_orders_equipment" ON "work_orders" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "IDX_work_orders_assigned_to" ON "work_orders" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "IDX_work_orders_status" ON "work_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_work_orders_due_date" ON "work_orders" USING btree ("due_date");