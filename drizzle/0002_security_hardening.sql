CREATE TABLE IF NOT EXISTS "processed_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- The application reads Telnyx only from the deployment environment. Remove
-- legacy browser-submitted copies so this credential is not retained in SQL.
UPDATE "settings" SET "telnyx_api_key" = NULL WHERE "telnyx_api_key" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meetings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transcripts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "processed_webhook_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "security_rate_limits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "agents", "calls", "campaigns", "contacts", "daily_metrics",
	"meetings", "settings", "transcripts", "processed_webhook_events",
	"security_rate_limits" FROM anon, authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.check_rate_limit(
	p_key text,
	p_limit integer,
	p_window_seconds integer
)
RETURNS TABLE(allowed boolean, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	IF p_limit < 1 OR p_window_seconds < 1 THEN
		RAISE EXCEPTION 'Invalid rate limit configuration';
	END IF;

	RETURN QUERY
	WITH current_state AS (
		INSERT INTO public.security_rate_limits AS limits ("key", "attempts", "window_started_at")
		VALUES (p_key, 1, now())
		ON CONFLICT ("key") DO UPDATE SET
			"attempts" = CASE
				WHEN limits."window_started_at" + make_interval(secs => p_window_seconds) <= now()
					THEN 1
				ELSE limits."attempts" + 1
			END,
			"window_started_at" = CASE
				WHEN limits."window_started_at" + make_interval(secs => p_window_seconds) <= now()
					THEN now()
				ELSE limits."window_started_at"
			END
		RETURNING "attempts", "window_started_at"
	)
	SELECT
		current_state."attempts" <= p_limit,
		GREATEST(
			0,
			CEIL(EXTRACT(EPOCH FROM (
				current_state."window_started_at"
				+ make_interval(secs => p_window_seconds)
				- now()
			)))
		)::integer
	FROM current_state;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.reset_rate_limit(p_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
	DELETE FROM public.security_rate_limits WHERE "key" = p_key;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_rate_limit(text) TO service_role;
