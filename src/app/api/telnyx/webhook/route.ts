import { NextResponse } from 'next/server';
import type { TranscriptTurn } from '@/lib/mockData';
import { summarizeCall } from '@/lib/server/aiSummaryService';
import { createCalendarEvent, isGoogleAppsScriptConfigured } from '@/lib/server/calendarService';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';

/* eslint-disable @typescript-eslint/no-explicit-any */

function callControlId(payload: any) {
  return payload.call_control_id || payload.call_leg_id || payload.call_session_id;
}

function normalizeTranscript(raw: any): TranscriptTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((turn) => ({
    role: (turn.role === 'assistant' || turn.role === 'agent' || turn.from === 'ai' ? 'agent' : 'user') as 'agent' | 'user',
    text: turn.text || turn.content || turn.transcript || '',
    timestamp: turn.timestamp || new Date().toISOString(),
  })).filter((turn) => turn.text);
}

async function findCall(telnyxCallId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase.from('calls').select('id, contact_id, campaign_id, started_at, contact:contacts(full_name, phone, company)').eq('telnyx_call_id', telnyxCallId).single();
  return data as any;
}

async function updateCall(telnyxCallId: string, values: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  if (supabase) await supabase.from('calls').update(values).eq('telnyx_call_id', telnyxCallId);
}

async function updateContact(telnyxCallId: string, status: string) {
  const supabase = getSupabaseAdmin();
  const call = await findCall(telnyxCallId);
  if (supabase && call?.contact_id) await supabase.from('contacts').update({ status }).eq('id', call.contact_id);
}

async function updateMetrics(call: any, durationSeconds: number, costUsd: number) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !call?.campaign_id) return;
  const { data: campaign } = await supabase.from('campaigns').select('calls_made, total_cost_usd').eq('id', call.campaign_id).single();
  await supabase.from('campaigns').update({ calls_made: (campaign?.calls_made || 0) + 1, total_cost_usd: (campaign?.total_cost_usd || 0) + costUsd }).eq('id', call.campaign_id);

  const date = new Date().toISOString().slice(0, 10);
  const { data: daily } = await supabase.from('daily_metrics').select('*').eq('date', date).maybeSingle();
  await supabase.from('daily_metrics').upsert({
    date, campaign_id: call.campaign_id, calls_made: (daily?.calls_made || 0) + 1,
    calls_answered: (daily?.calls_answered || 0) + (durationSeconds > 0 ? 1 : 0),
    meetings_booked: daily?.meetings_booked || 0,
    minutes_talked: (daily?.minutes_talked || 0) + durationSeconds / 60,
    cost_usd: (daily?.cost_usd || 0) + costUsd,
  });
}

async function handleConversationEnded(telnyxCallId: string, payload: any) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const call = await findCall(telnyxCallId);
  if (!call) return;

  const { data: settings } = await supabase.from('settings').select('timezone, google_calendar_connected').eq('id', 'default').single();
  const transcript = normalizeTranscript(payload.transcript || payload.conversation || payload.messages);
  const summary = await summarizeCall(transcript, settings?.timezone || 'America/Bogota');
  await supabase.from('transcripts').upsert({
    id: `tr_${call.id}`, call_id: call.id, full_transcript: transcript, ai_summary: summary.summary,
    interested: summary.interested, sentiment: summary.sentiment, next_steps: summary.nextSteps,
  });
  if (payload.recording_url || payload.media_url) await updateCall(telnyxCallId, { recording_url: payload.recording_url || payload.media_url });
  if (!summary.interested || !summary.proposedDateTime) return;

  const meetingId = `mtg_${crypto.randomUUID()}`;
  let googleEventId: string | null = null;
  if (settings?.google_calendar_connected || isGoogleAppsScriptConfigured()) {
    try {
      const event = await createCalendarEvent({
        title: `Reunión con ${call.contact?.full_name || 'contacto'}`,
        description: `Reunión agendada automáticamente por Contact Center IA.\n\n${summary.summary}`,
        scheduledAt: summary.proposedDateTime, durationMin: 15, timezone: settings?.timezone || 'America/Bogota',
      });
      googleEventId = event.id;
    } catch (error) {
      console.error('[Calendar] Meeting saved locally; Google event failed:', error);
    }
  }
  await supabase.from('meetings').insert({ id: meetingId, call_id: call.id, contact_id: call.contact_id, scheduled_at: summary.proposedDateTime, duration_min: 15, google_event_id: googleEventId, status: 'scheduled' });
  await supabase.from('contacts').update({ status: 'scheduled' }).eq('id', call.contact_id);
  await updateCall(telnyxCallId, { outcome: 'meeting_booked' });

  const { data: campaign } = await supabase.from('campaigns').select('meetings_booked').eq('id', call.campaign_id).single();
  await supabase.from('campaigns').update({ meetings_booked: (campaign?.meetings_booked || 0) + 1 }).eq('id', call.campaign_id);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = body.data || body;
    const eventType = data.event_type || data.record_type;
    const payload = data.payload || {};
    const telnyxCallId = callControlId(payload);
    if (!eventType || !telnyxCallId) return NextResponse.json({ received: true });
    if (useMockServices) console.info(`[Webhook mock] ${eventType}: ${telnyxCallId}`);

    if (eventType === 'call.initiated') await updateCall(telnyxCallId, { status: 'ringing', started_at: new Date().toISOString() });
    if (eventType === 'call.answered') {
      await updateCall(telnyxCallId, { status: 'in_progress' });
      await updateContact(telnyxCallId, 'answered');
    }
    if (eventType === 'call.hangup') {
      const call = await findCall(telnyxCallId);
      const durationSeconds = Number(payload.duration_secs || (call?.started_at ? Math.max(0, Math.round((Date.now() - new Date(call.started_at).getTime()) / 1000)) : 0));
      const costUsd = Number(((durationSeconds / 60) * 0.006).toFixed(4));
      await updateCall(telnyxCallId, { status: 'completed', ended_at: new Date().toISOString(), duration_seconds: durationSeconds, cost_usd: costUsd, outcome: payload.hangup_cause || (durationSeconds ? 'completed' : 'no_answer') });
      if (!durationSeconds) await updateContact(telnyxCallId, 'no_answer');
      await updateMetrics(call, durationSeconds, costUsd);
    }
    if (eventType === 'assistant.conversation.ended' || eventType === 'ai.conversation_ended') await handleConversationEnded(telnyxCallId, payload);
    return NextResponse.json({ received: true, event: eventType });
  } catch (error) {
    console.error('[Telnyx Webhook]', error);
    return NextResponse.json({ received: true, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Telnyx webhook endpoint active', version: '2.0' });
}
