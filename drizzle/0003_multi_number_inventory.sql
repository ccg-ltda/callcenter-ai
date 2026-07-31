CREATE TABLE IF NOT EXISTS "phone_numbers" (
	"phone_number" text PRIMARY KEY NOT NULL,
	"telnyx_id" text,
	"status" text DEFAULT 'active',
	"inbound_agent_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "phone_numbers_inbound_agent_id_agents_id_fk"
		FOREIGN KEY ("inbound_agent_id") REFERENCES "public"."agents"("id")
		ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "outbound_phone_number" text;
--> statement-breakpoint
INSERT INTO "phone_numbers" ("phone_number", "status", "inbound_agent_id")
SELECT "telnyx_phone_number", 'active', "inbound_agent_id"
FROM "settings"
WHERE "id" = 'default' AND COALESCE("telnyx_phone_number", '') <> ''
ON CONFLICT ("phone_number") DO UPDATE
SET "inbound_agent_id" = COALESCE(
	"phone_numbers"."inbound_agent_id",
	EXCLUDED."inbound_agent_id"
);
--> statement-breakpoint
ALTER TABLE "phone_numbers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "phone_numbers" FROM anon, authenticated;
