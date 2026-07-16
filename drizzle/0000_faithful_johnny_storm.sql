CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"voice" text NOT NULL,
	"script" text NOT NULL,
	"goal" text DEFAULT 'agendar_reunion',
	"meeting_duration_min" integer DEFAULT 15,
	"telnyx_assistant_id" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text,
	"campaign_id" text,
	"telnyx_call_id" text,
	"status" text DEFAULT 'queued',
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer DEFAULT 0,
	"cost_usd" real DEFAULT 0,
	"recording_url" text,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"agent_id" text,
	"status" text DEFAULT 'draft',
	"total_contacts" integer DEFAULT 0,
	"calls_made" integer DEFAULT 0,
	"meetings_booked" integer DEFAULT 0,
	"total_cost_usd" real DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"launched_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"company" text,
	"custom_fields" jsonb,
	"status" text DEFAULT 'pending',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_metrics" (
	"date" text PRIMARY KEY NOT NULL,
	"campaign_id" text,
	"calls_made" integer DEFAULT 0,
	"calls_answered" integer DEFAULT 0,
	"meetings_booked" integer DEFAULT 0,
	"minutes_talked" real DEFAULT 0,
	"cost_usd" real DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"call_id" text,
	"contact_id" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_min" integer DEFAULT 15,
	"google_event_id" text,
	"status" text DEFAULT 'scheduled',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"telnyx_api_key" text,
	"telnyx_phone_number" text,
	"telnyx_assistant_id" text,
	"google_calendar_connected" boolean DEFAULT false,
	"google_refresh_token" text,
	"call_window_start" text DEFAULT '10:00',
	"call_window_end" text DEFAULT '18:00',
	"timezone" text DEFAULT 'America/Argentina/Buenos_Aires',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" text PRIMARY KEY NOT NULL,
	"call_id" text,
	"full_transcript" jsonb,
	"ai_summary" text,
	"interested" boolean,
	"sentiment" text,
	"next_steps" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;