ALTER TABLE "campaigns"
ADD COLUMN IF NOT EXISTS "max_concurrent_calls" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "campaigns"
ADD CONSTRAINT "campaigns_max_concurrent_calls_check"
CHECK ("max_concurrent_calls" BETWEEN 1 AND 50);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.claim_next_campaign_contact(p_campaign_id text)
RETURNS TABLE(
	contact_id text,
	full_name text,
	phone text,
	custom_fields jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	v_campaign public.campaigns%ROWTYPE;
	v_contact public.contacts%ROWTYPE;
	v_active_calls integer;
BEGIN
	-- Serializes every slot decision for one campaign. This prevents two
	-- simultaneous webhooks from claiming more contacts than the configured cap.
	SELECT * INTO v_campaign
	FROM public.campaigns
	WHERE id = p_campaign_id
	FOR UPDATE;

	IF NOT FOUND OR v_campaign.status <> 'active' THEN
		RETURN;
	END IF;

	SELECT count(*)::integer INTO v_active_calls
	FROM public.contacts AS contact
	WHERE contact.campaign_id = p_campaign_id
		AND (
			contact.status = 'calling'
			OR EXISTS (
				SELECT 1
				FROM public.calls AS call
				WHERE call.contact_id = contact.id
					AND call.status IN ('queued', 'ringing', 'in_progress')
			)
		);

	IF v_active_calls >= v_campaign.max_concurrent_calls THEN
		RETURN;
	END IF;

	SELECT * INTO v_contact
	FROM public.contacts AS contact
	WHERE contact.campaign_id = p_campaign_id
		AND contact.status = 'pending'
	ORDER BY contact.created_at, contact.id
	FOR UPDATE SKIP LOCKED
	LIMIT 1;

	IF NOT FOUND THEN
		IF v_active_calls = 0 THEN
			UPDATE public.campaigns
			SET status = 'finished', finished_at = now()
			WHERE id = p_campaign_id AND status = 'active';
		END IF;
		RETURN;
	END IF;

	UPDATE public.contacts SET status = 'calling' WHERE id = v_contact.id;
	contact_id := v_contact.id;
	full_name := v_contact.full_name;
	phone := v_contact.phone;
	custom_fields := v_contact.custom_fields;
	RETURN NEXT;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.claim_next_campaign_contact(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_campaign_contact(text) TO service_role;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.increment_campaign_call_metrics(
	p_campaign_id text,
	p_cost_usd real,
	p_duration_seconds integer,
	p_answered boolean,
	p_date text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
	UPDATE public.campaigns
	SET calls_made = COALESCE(calls_made, 0) + 1,
		total_cost_usd = COALESCE(total_cost_usd, 0) + GREATEST(COALESCE(p_cost_usd, 0), 0)
	WHERE id = p_campaign_id;

	INSERT INTO public.daily_metrics (
		date, campaign_id, calls_made, calls_answered, meetings_booked, minutes_talked, cost_usd
	) VALUES (
		p_date,
		p_campaign_id,
		1,
		CASE WHEN p_answered THEN 1 ELSE 0 END,
		0,
		GREATEST(COALESCE(p_duration_seconds, 0), 0)::real / 60,
		GREATEST(COALESCE(p_cost_usd, 0), 0)
	)
	ON CONFLICT (date) DO UPDATE SET
		calls_made = COALESCE(public.daily_metrics.calls_made, 0) + 1,
		calls_answered = COALESCE(public.daily_metrics.calls_answered, 0) + CASE WHEN p_answered THEN 1 ELSE 0 END,
		minutes_talked = COALESCE(public.daily_metrics.minutes_talked, 0) + GREATEST(COALESCE(p_duration_seconds, 0), 0)::real / 60,
		cost_usd = COALESCE(public.daily_metrics.cost_usd, 0) + GREATEST(COALESCE(p_cost_usd, 0), 0);
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.increment_campaign_call_metrics(text, real, integer, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_campaign_call_metrics(text, real, integer, boolean, text) TO service_role;
