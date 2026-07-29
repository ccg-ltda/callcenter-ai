ALTER TABLE "calls" ADD COLUMN "agent_id" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "direction" text DEFAULT 'outbound';--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "from_number" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "to_number" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "inbound_agent_id" text;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;