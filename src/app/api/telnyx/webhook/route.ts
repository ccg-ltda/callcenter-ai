import { after, NextResponse } from 'next/server';
import { createCalendarEvent, isGoogleAppsScriptConfigured } from '@/lib/server/calendarService';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { syncCallTranscript } from '@/lib/server/transcriptSync';
import { normalizePhoneNumber } from '@/lib/phoneNumbers';
import { approvedAutomatedMeetingDate } from '@/lib/server/meetingSafety';
import { readTelnyxBody, verifyTelnyxRequest } from '@/lib/server/telnyxWebhook';
import { dispatchCampaignCalls } from '@/lib/server/campaignDispatcher';

/* eslint-disable @typescript-eslint/no-explicit-any */

const recentWebhookEvents = new Map<string, number>();

function callIdentifiers(payload: any) {
  return [payload.call_control_id, payload.call_leg_id, payload.call_session_id, payload.call_sid, payload.CallSid, payload.CallSidLegacy]
    .filter((value, index, values): value is string =>
      typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 256 &&
      values.indexOf(value) === index);
}

function safeRecordingUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeDuration(value: unknown) {
  const duration = Number(value);
  if (!Number.isFinite(duration)) return 0;
  return Math.min(86_400, Math.max(0, Math.round(duration)));
}

async function claimWebhookEvent(eventId: unknown) {
  if (typeof eventId !== 'string' || !eventId || eventId.length > 256) return true;
  const now = Date.now();
  for (const [id, expiresAt] of recentWebhookEvents) {
    if (expiresAt <= now) recentWebhookEvents.delete(id);
  }
  if (recentWebhookEvents.has(eventId)) return false;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    recentWebhookEvents.set(eventId, now + 10 * 60_000);
    return true;
  }
  const { error } = await supabase.from('processed_webhook_events').insert({ id: eventId });
  if (!error) {
    recentWebhookEvents.set(eventId, now + 10 * 60_000);
    return true;
  }
  if (error.code === '23505') return false;
  if (['42P01', 'PGRST205'].includes(error.code || '')) {
    console.warn('[Telnyx Webhook] Persistent idempotency table is not migrated; using memory.');
    recentWebhookEvents.set(eventId, now + 10 * 60_000);
    return true;
  }
  throw error;
}

async function releaseWebhookEvent(eventId: unknown) {
  if (typeof eventId !== 'string' || !eventId) return;
  recentWebhookEvents.delete(eventId);
  const supabase = getSupabaseAdmin();
  if (supabase) await supabase.from('processed_webhook_events').delete().eq('id', eventId);
}

async function findCall(identifiers: string[]) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !identifiers.length) return null;
  const { data } = await supabase
    .from('calls')
    .select('id, contact_id, campaign_id, agent_id, direction, from_number, to_number, status, started_at, telnyx_call_id, contact:contacts(full_name, phone, company)')
    .in('telnyx_call_id', identifiers)
    .limit(1)
    .maybeSingle();
  return data as any;
}

async function updateCall(identifiers: string[], values: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  if (supabase && identifiers.length) await supabase.from('calls').update(values).in('telnyx_call_id', identifiers);
}

function payloadValue(payload: any, ...keys: string[]) {
  for (const key of keys) {
    const value = payload?.[key];
    if (typeof value === 'string' && value) return value;
  }
  return '';
}

async function ensureInboundCall(identifiers: string[], payload: any) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !identifiers.length || await findCall(identifiers)) return;

  const toNumber = payloadValue(payload, 'To', 'to', 'called_number', 'destination');
  const fromNumber = payloadValue(payload, 'From', 'from', 'caller_number', 'originating_number');
  if (!toNumber) return;

  const normalizedToNumber = normalizePhoneNumber(toNumber);
  const inventoryResult = await supabase
    .from('phone_numbers')
    .select('phone_number, inbound_agent_id')
    .eq('phone_number', normalizedToNumber)
    .maybeSingle();
  let inboundAgentId = inventoryResult.data?.inbound_agent_id || '';
  if (inventoryResult.error && !['42P01', 'PGRST205'].includes(inventoryResult.error.code || '')) {
    throw inventoryResult.error;
  }
  if (!inboundAgentId) {
    const { data: settings } = await supabase
      .from('settings')
      .select('telnyx_phone_number, inbound_agent_id')
      .eq('id', 'default')
      .maybeSingle();
    if (normalizePhoneNumber(settings?.telnyx_phone_number || '') === normalizedToNumber) {
      inboundAgentId = settings?.inbound_agent_id || '';
    }
  }
  if (!inboundAgentId) return;

  await supabase.from('calls').upsert({
    id: identifiers[0],
    telnyx_call_id: identifiers[0],
    agent_id: inboundAgentId,
    direction: 'inbound',
    from_number: fromNumber || null,
    to_number: toNumber,
    status: 'ringing',
    started_at: new Date().toISOString(),
  }, { onConflict: 'id' });
}

async function updateContact(identifiers: string[], status: string) {
  const supabase = getSupabaseAdmin();
  const call = await findCall(identifiers);
  if (supabase && call?.contact_id) await supabase.from('contacts').update({ status }).eq('id', call.contact_id);
}

async function updateMetrics(call: any, durationSeconds: number, costUsd: number) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !call?.campaign_id) return;
  const { error: campaignMetricsError } = await supabase.rpc('increment_campaign_call_metrics', {
    p_campaign_id: call.campaign_id,
    p_cost_usd: costUsd,
    p_duration_seconds: durationSeconds,
    p_answered: call.status === 'in_progress',
    p_date: new Date().toISOString().slice(0, 10),
  });
  if (campaignMetricsError) throw campaignMetricsError;
}

async function handleConversationEnded(identifiers: string[], payload: any) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const call = await findCall(identifiers);
  if (!call) return;

  const { data: settings } = await supabase.from('settings').select('timezone, google_calendar_connected').eq('id', 'default').single();
  const recordingUrl = safeRecordingUrl(payload.recording_url || payload.media_url);
  await updateCall(identifiers, {
    status: 'completed',
    ended_at: new Date().toISOString(),
    ...(payload.duration_sec ? { duration_seconds: safeDuration(payload.duration_sec) } : {}),
    ...(recordingUrl ? { recording_url: recordingUrl } : {}),
  });
  const synced = await syncCallTranscript(call.id, {
    conversationId: payload.conversation_id,
    rawTranscript: payload.transcript || payload.conversation || payload.messages,
    telnyxCallId: call.telnyx_call_id || identifiers[0],
  });
  if (!synced) return;
  const { summary } = synced;
  if (!call.contact_id || !call.campaign_id) return;
  const scheduledAt = approvedAutomatedMeetingDate(
    summary,
    synced.transcript.full_transcript,
  );
  if (!scheduledAt) return;

  const meetingId = `mtg_${crypto.randomUUID()}`;
  let googleEventId: string | null = null;
  if (settings?.google_calendar_connected || isGoogleAppsScriptConfigured()) {
    try {
      const event = await createCalendarEvent({
        title: `Reunión con ${call.contact?.full_name || 'contacto'}`,
        description: `Reunión agendada automáticamente por Contact Center IA.\n\n${summary.summary}`,
        scheduledAt, durationMin: 15, timezone: settings?.timezone || 'America/Bogota',
      });
      googleEventId = event.id;
    } catch (error) {
      console.error('[Calendar] Meeting saved locally; Google event failed:', error);
    }
  }
  await supabase.from('meetings').insert({ id: meetingId, call_id: call.id, contact_id: call.contact_id, scheduled_at: scheduledAt, duration_min: 15, google_event_id: googleEventId, status: 'scheduled' });
  await supabase.from('contacts').update({ status: 'scheduled' }).eq('id', call.contact_id);
  await updateCall(identifiers, { outcome: 'meeting_booked' });

  const { data: campaign } = await supabase.from('campaigns').select('meetings_booked').eq('id', call.campaign_id).single();
  await supabase.from('campaigns').update({ meetings_booked: (campaign?.meetings_booked || 0) + 1 }).eq('id', call.campaign_id);
}

export async function POST(request: Request) {
  let eventId: unknown;
  try {
    const rawBody = await readTelnyxBody(request);
    await verifyTelnyxRequest(request, rawBody);
    const contentType = request.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
      ? JSON.parse(rawBody)
      : Object.fromEntries(new URLSearchParams(rawBody).entries());
    const data = body.data || body;
    eventId = data.id;
    if (!await claimWebhookEvent(eventId)) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    const callStatus = typeof data.CallStatus === 'string' ? data.CallStatus.toLowerCase() : '';
    const eventType = data.event_type || (callStatus === 'completed' ? 'call.hangup' : callStatus ? `call.${callStatus}` : data.record_type);
    const payload = data.payload || data;
    const identifiers = callIdentifiers(payload);
    if (!eventType || !identifiers.length) return NextResponse.json({ received: true });
    if (useMockServices) console.info(`[Webhook mock] ${eventType}: ${identifiers[0]}`);
    await ensureInboundCall(identifiers, payload);

    if (eventType === 'call.initiated') await updateCall(identifiers, { status: 'ringing', started_at: new Date().toISOString() });
    if (eventType === 'call.answered') {
      await updateCall(identifiers, { status: 'in_progress' });
      await updateContact(identifiers, 'answered');
    }
    if (eventType === 'call.hangup') {
      const call = await findCall(identifiers);
      const durationSeconds = safeDuration(payload.duration_secs || payload.CallDuration || (call?.started_at ? Math.max(0, Math.round((Date.now() - new Date(call.started_at).getTime()) / 1000)) : 0));
      const costUsd = Number(((durationSeconds / 60) * 0.006).toFixed(4));
      await updateCall(identifiers, { status: 'completed', ended_at: new Date().toISOString(), duration_seconds: durationSeconds, cost_usd: costUsd, outcome: payload.hangup_cause || (durationSeconds ? 'completed' : 'no_answer') });
      await updateContact(identifiers, call?.status === 'in_progress' ? 'answered' : 'no_answer');
      await updateMetrics(call, durationSeconds, costUsd);
      if (call?.campaign_id) {
        after(async () => {
          try {
            await dispatchCampaignCalls(call.campaign_id);
          } catch (error) {
            console.error(`[Campaign] Could not refill campaign ${call.campaign_id}`, error);
          }
        });
      }
      if (call) {
        try {
          await syncCallTranscript(call.id, { telnyxCallId: call.telnyx_call_id || identifiers[0] });
        } catch (error) {
          console.error('[Telnyx Webhook] Transcript reconciliation will be retried from the dashboard:', error);
        }
      }
    }
    if (['conversation_ended', 'call.conversation.ended', 'assistant.conversation.ended', 'ai.conversation_ended'].includes(eventType)) {
      await handleConversationEnded(identifiers, payload);
    }
    return NextResponse.json({ received: true, event: eventType });
  } catch (error) {
    await releaseWebhookEvent(eventId);
    console.error('[Telnyx Webhook]', error);
    const message = error instanceof Error ? error.message : '';
    const status = message.includes('tamaño') ? 413
      : message.includes('configurada') ? 503
      : message.includes('JSON') ? 400
      : 401;
    return NextResponse.json({ error: 'Webhook de Telnyx rechazado.' }, { status });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Telnyx webhook endpoint active', version: '2.0' });
}
