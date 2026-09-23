CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TYPE "public"."assessment_kind" AS ENUM('topic', 'checkpoint', 'revision');--> statement-breakpoint
CREATE TYPE "public"."plan_completion" AS ENUM('yes', 'partly', 'no');--> statement-breakpoint
CREATE TYPE "public"."content_source" AS ENUM('catalog', 'engine', 'ai');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'paused', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."learning_style" AS ENUM('reading', 'video', 'hands_on', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."learner_level" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."memory_kind" AS ENUM('strength', 'weakness', 'preference', 'mistake', 'skill', 'goal', 'project_context');--> statement-breakpoint
CREATE TYPE "public"."memory_source" AS ENUM('assessment', 'check_in', 'mentor', 'onboarding', 'progress');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('daily_reminder', 'incomplete_plan', 'revision_due', 'milestone', 'assessment_available', 'roadmap_adjusted', 'system');--> statement-breakpoint
CREATE TYPE "public"."plan_item_kind" AS ENUM('learn', 'practice', 'assess', 'revise', 'project', 'carry_over');--> statement-breakpoint
CREATE TYPE "public"."plan_item_status" AS ENUM('pending', 'done', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('active', 'completed', 'partial', 'missed');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('mcq', 'true_false', 'short', 'code');--> statement-breakpoint
CREATE TYPE "public"."resource_cost" AS ENUM('free', 'freemium', 'paid');--> statement-breakpoint
CREATE TYPE "public"."resource_role" AS ENUM('primary', 'alternative', 'practice', 'project');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('documentation', 'tutorial', 'course', 'video', 'interactive', 'book', 'project', 'exercise', 'article');--> statement-breakpoint
CREATE TYPE "public"."roadmap_status" AS ENUM('generating', 'ready', 'failed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."saved_status" AS ENUM('saved', 'in_progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."session_kind" AS ENUM('learn', 'practice', 'assess', 'revise', 'project');--> statement-breakpoint
CREATE TYPE "public"."tomorrow_pref" AS ENUM('lighter', 'similar', 'harder');--> statement-breakpoint
CREATE TYPE "public"."topic_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" uuid,
	"day" date NOT NULL,
	"completed_plan" "plan_completion" NOT NULL,
	"minutes_studied" smallint NOT NULL,
	"difficulty" smallint NOT NULL,
	"confidence" smallint NOT NULL,
	"blockers" text[] DEFAULT '{}' NOT NULL,
	"blocker_note" text,
	"tomorrow" "tomorrow_pref" NOT NULL,
	"adaptation" text DEFAULT '' NOT NULL,
	"review_bias" integer DEFAULT 0 NOT NULL,
	"intensity_after" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"position" smallint NOT NULL,
	"kind" "plan_item_kind" NOT NULL,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"minutes" smallint NOT NULL,
	"ref" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "plan_item_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "daily_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"goal_id" uuid,
	"day" date NOT NULL,
	"budget_minutes" smallint NOT NULL,
	"planned_minutes" smallint NOT NULL,
	"focus" text NOT NULL,
	"rationale" text[] DEFAULT '{}' NOT NULL,
	"ai_note" text,
	"status" "plan_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"topic_id" uuid,
	"kind" "session_kind" NOT NULL,
	"minutes" smallint NOT NULL,
	"summary" text,
	"day" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"content" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"topic_id" uuid,
	"project_id" uuid,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "memory_kind" NOT NULL,
	"key" text NOT NULL,
	"content" text NOT NULL,
	"topic_id" uuid,
	"source" "memory_source" NOT NULL,
	"confidence" real DEFAULT 0.6 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"times_observed" smallint DEFAULT 1 NOT NULL,
	"last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"assessment_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"results" jsonb NOT NULL,
	"score" smallint NOT NULL,
	"passed" boolean NOT NULL,
	"summary" jsonb NOT NULL,
	"duration_seconds" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"type" "question_type" NOT NULL,
	"prompt" text NOT NULL,
	"code" text,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answer" text NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"explanation" text NOT NULL,
	"concept" text NOT NULL,
	"points" smallint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"roadmap_id" uuid,
	"topic_id" uuid,
	"kind" "assessment_kind" DEFAULT 'topic' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"pass_score" smallint DEFAULT 70 NOT NULL,
	"source" "content_source" DEFAULT 'catalog' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"track_slug" text,
	"level" "learner_level" NOT NULL,
	"target_role" text,
	"daily_minutes" smallint NOT NULL,
	"deadline" date,
	"motivation" text,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"level" "learner_level" DEFAULT 'beginner' NOT NULL,
	"existing_skills" text[] DEFAULT '{}' NOT NULL,
	"daily_minutes" smallint DEFAULT 60 NOT NULL,
	"learning_style" "learning_style" DEFAULT 'mixed' NOT NULL,
	"target_role" text,
	"deadline" date,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"universe_mode" text DEFAULT 'auto' NOT NULL,
	"reduced_motion" boolean DEFAULT false NOT NULL,
	"reminder_hour" smallint DEFAULT 18 NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"intensity_pct" integer DEFAULT 100 NOT NULL,
	"mentor_answer_style" text DEFAULT 'guided' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"topic_id" uuid,
	"resource_id" uuid,
	"project_id" uuid,
	"session_id" uuid,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_title_len" CHECK (char_length("notes"."title") between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "project_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "project_status" DEFAULT 'not_started' NOT NULL,
	"completed_milestones" smallint[] DEFAULT '{}' NOT NULL,
	"repo_url" text,
	"reflection" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"roadmap_id" uuid,
	"phase_id" uuid,
	"topic_id" uuid,
	"title" text NOT NULL,
	"goal" text NOT NULL,
	"difficulty" smallint NOT NULL,
	"concepts" text[] DEFAULT '{}' NOT NULL,
	"requirements" text[] DEFAULT '{}' NOT NULL,
	"suggested_stack" text[] DEFAULT '{}' NOT NULL,
	"milestones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_hours" smallint DEFAULT 4 NOT NULL,
	"source" "content_source" DEFAULT 'catalog' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"provider" text NOT NULL,
	"type" "resource_type" NOT NULL,
	"difficulty" smallint NOT NULL,
	"cost" "resource_cost" NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"prerequisites" text DEFAULT '' NOT NULL,
	"description" text NOT NULL,
	"why_useful" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "saved_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"status" "saved_status" DEFAULT 'saved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_resources" (
	"topic_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"role" "resource_role" NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "topic_resources_topic_id_resource_id_pk" PRIMARY KEY("topic_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "roadmap_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roadmap_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"milestone_title" text NOT NULL,
	"milestone_detail" text DEFAULT '' NOT NULL,
	"milestone_reached_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"goal_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"status" "roadmap_status" DEFAULT 'generating' NOT NULL,
	"source" "content_source" DEFAULT 'catalog' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"adjustment_note" text,
	"adjusted_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_prerequisites" (
	"topic_id" uuid NOT NULL,
	"prerequisite_id" uuid NOT NULL,
	CONSTRAINT "topic_prerequisites_topic_id_prerequisite_id_pk" PRIMARY KEY("topic_id","prerequisite_id")
);
--> statement-breakpoint
CREATE TABLE "topic_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"topic_id" uuid NOT NULL,
	"status" "topic_status" DEFAULT 'not_started' NOT NULL,
	"progress_pct" smallint DEFAULT 0 NOT NULL,
	"mastery" smallint DEFAULT 0 NOT NULL,
	"minutes_spent" integer DEFAULT 0 NOT NULL,
	"practice_done" smallint[] DEFAULT '{}' NOT NULL,
	"prior_knowledge" boolean DEFAULT false NOT NULL,
	"review_count" smallint DEFAULT 0 NOT NULL,
	"ease_factor" real DEFAULT 2.5 NOT NULL,
	"interval_days" smallint DEFAULT 0 NOT NULL,
	"next_review_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"roadmap_id" uuid NOT NULL,
	"phase_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"catalog_key" text,
	"domain" text DEFAULT 'General' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"difficulty" smallint NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"position" smallint NOT NULL,
	"concepts" text[] DEFAULT '{}' NOT NULL,
	"practice" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" "content_source" DEFAULT 'catalog' NOT NULL,
	"is_reinforcement" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "background_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"runner" text DEFAULT 'inline' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text,
	"dedupe_key" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" smallint DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text NOT NULL,
	"embedding" vector(256) NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(body, '')), 'B')) STORED,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_plan_id_daily_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."daily_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plan_items" ADD CONSTRAINT "daily_plan_items_plan_id_daily_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."daily_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plan_items" ADD CONSTRAINT "daily_plan_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_cache" ADD CONSTRAINT "ai_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_memory" ADD CONSTRAINT "ai_memory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_memory" ADD CONSTRAINT "ai_memory_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_session_id_learning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_progress" ADD CONSTRAINT "project_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_progress" ADD CONSTRAINT "project_progress_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_phase_id_roadmap_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."roadmap_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_resources" ADD CONSTRAINT "saved_resources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_resources" ADD CONSTRAINT "saved_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_resources" ADD CONSTRAINT "topic_resources_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_resources" ADD CONSTRAINT "topic_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_phases" ADD CONSTRAINT "roadmap_phases_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_prerequisites" ADD CONSTRAINT "topic_prerequisites_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_prerequisites" ADD CONSTRAINT "topic_prerequisites_prerequisite_id_topics_id_fk" FOREIGN KEY ("prerequisite_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_phase_id_roadmap_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."roadmap_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "check_ins_user_day_uq" ON "check_ins" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "daily_plan_items_plan_idx" ON "daily_plan_items" USING btree ("plan_id","position");--> statement-breakpoint
CREATE INDEX "daily_plan_items_user_idx" ON "daily_plan_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_plans_user_day_uq" ON "daily_plans" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "learning_sessions_user_day_idx" ON "learning_sessions" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "learning_sessions_topic_idx" ON "learning_sessions" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_cache_user_key_uq" ON "ai_cache" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "ai_conversations_user_idx" ON "ai_conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_memory_user_kind_key_uq" ON "ai_memory" USING btree ("user_id","kind","key");--> statement-breakpoint
CREATE INDEX "ai_memory_user_idx" ON "ai_memory" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "ai_messages_conversation_idx" ON "ai_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "assessment_attempts_user_idx" ON "assessment_attempts" USING btree ("user_id","assessment_id","created_at");--> statement-breakpoint
CREATE INDEX "assessment_questions_assessment_idx" ON "assessment_questions" USING btree ("assessment_id","position");--> statement-breakpoint
CREATE INDEX "assessments_user_idx" ON "assessments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assessments_topic_idx" ON "assessments" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "goals_user_idx" ON "goals" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_one_primary_per_user" ON "goals" USING btree ("user_id") WHERE "goals"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "notes_user_idx" ON "notes" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "notes_topic_idx" ON "notes" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "notes_search_idx" ON "notes" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "project_progress_user_project_uq" ON "project_progress" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX "projects_user_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_topic_idx" ON "projects" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "resources_type_idx" ON "resources" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_resources_user_resource_uq" ON "saved_resources" USING btree ("user_id","resource_id");--> statement-breakpoint
CREATE INDEX "topic_resources_resource_idx" ON "topic_resources" USING btree ("resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roadmap_phases_position_uq" ON "roadmap_phases" USING btree ("roadmap_id","position");--> statement-breakpoint
CREATE INDEX "roadmaps_user_idx" ON "roadmaps" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roadmaps_one_active_per_goal" ON "roadmaps" USING btree ("goal_id") WHERE "roadmaps"."status" <> 'archived';--> statement-breakpoint
CREATE INDEX "topic_prereq_reverse_idx" ON "topic_prerequisites" USING btree ("prerequisite_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topic_progress_user_topic_uq" ON "topic_progress" USING btree ("user_id","topic_id");--> statement-breakpoint
CREATE INDEX "topic_progress_review_idx" ON "topic_progress" USING btree ("user_id","next_review_at");--> statement-breakpoint
CREATE INDEX "topics_user_idx" ON "topics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "topics_roadmap_idx" ON "topics" USING btree ("roadmap_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_roadmap_slug_uq" ON "topics" USING btree ("roadmap_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "background_jobs_idempotency_uq" ON "background_jobs" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "background_jobs_status_idx" ON "background_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_dedupe_uq" ON "notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","read","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "search_documents_entity_uq" ON "search_documents" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "search_documents_user_idx" ON "search_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "search_documents_fts_idx" ON "search_documents" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "search_documents_embedding_idx" ON "search_documents" USING hnsw ("embedding" vector_cosine_ops);