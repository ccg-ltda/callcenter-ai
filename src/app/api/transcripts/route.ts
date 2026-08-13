import { NextResponse } from 'next/server';
import { mockTranscripts } from '@/lib/mockData';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { reconcileRecentInboundCalls } from '@/lib/server/inboundCallSync';
import { syncCallTranscript } from '@/lib/server/transcriptSync';
import { requireApiAuth } from '@/lib/server/routeSecurity';
import { telnyxService } from '@/lib/telnyxService';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  if (useMockServices) return NextResponse.json(mockTranscripts);
  await reconcileRecentInboundCalls();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase!
    .from('calls')
    .select('*, contact:contacts(id, full_name, phone, company), agent:agents(id, name), transcript:transcripts(*)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pendingCalls = (data || []).filter((call: any) => {
    const transcript = Array.isArray(call.transcript) ? call.transcript[0] : call.transcript;
    return call.telnyx_call_id
      && (!transcript || !Array.isArray(transcript.full_transcript) || !transcript.full_transcript.length);
  }).slice(0, 10);
  const callsNeedingDuration = (data || []).filter((call: any) =>
    call.telnyx_call_id
    && (Number(call.duration_seconds) <= 0 || !['completed', 'failed'].includes(call.status)),
  );
  let recentConversations = [] as Awaited<ReturnType<typeof telnyxService.listRecentConversations>>;
  try {
    recentConversations = pendingCalls.length || callsNeedingDuration.length
      ? await telnyxService.listRecentConversations(100)
      : [];
  } catch (conversationError) {
    console.error('[Transcripts] Could not list recent Telnyx conversations:', conversationError);
  }
  const conversationByCallId = new Map(
    recentConversations
      .filter((conversation) => conversation.metadata?.call_control_id)
      .map((conversation) => [conversation.metadata!.call_control_id!, conversation]),
  );
  const durationUpdates = await Promise.allSettled(callsNeedingDuration.map(async (call: any) => {
    const conversation = conversationByCallId.get(call.telnyx_call_id);
    if (!conversation?.created_at || !conversation.last_message_at) return;
    const durationSeconds = Math.max(1, Math.round(
      (new Date(conversation.last_message_at).getTime() - new Date(conversation.created_at).getTime()) / 1_000,
    ));
    if (!Number.isFinite(durationSeconds) || durationSeconds <= Number(call.duration_seconds || 0)) return;
    const { error: durationError } = await supabase!
      .from('calls')
      .update({ duration_seconds: durationSeconds })
      .eq('id', call.id);
    if (durationError) throw durationError;
    call.duration_seconds = durationSeconds;
  }));
  durationUpdates.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`[Transcripts] Could not update duration for call ${callsNeedingDuration[index].id}:`, result.reason);
    }
  });
  const reconciled = await Promise.allSettled(pendingCalls.map(async (call: any) => {
    const conversation = conversationByCallId.get(call.telnyx_call_id);
    // Telnyx can leave TeXML calls as ringing/queued in our database even
    // after their AI conversation and messages are available. Reconcile from
    // the conversation directly instead of waiting for a completed webhook.
    if (!conversation && call.status !== 'completed') return;
    const result = await syncCallTranscript(call.id, {
      conversationId: conversation?.id,
      telnyxCallId: call.telnyx_call_id,
    });
    if (result) call.transcript = [{ ...result.transcript, created_at: new Date().toISOString() }];
  }));
  reconciled.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`[Transcripts] Could not reconcile call ${pendingCalls[index].id}:`, result.reason);
    }
  });

  return NextResponse.json((data || []).map((call: any) => {
    const transcript = Array.isArray(call.transcript) ? call.transcript[0] : call.transcript;
    const fullTranscript = Array.isArray(transcript?.full_transcript) ? transcript.full_transcript : [];
    return {
      id: transcript?.id || `pending_${call.id}`,
      callId: call.id,
      hasTranscript: fullTranscript.length > 0,
      fullTranscript,
      aiSummary: transcript?.ai_summary || 'La transcripción de esta llamada todavía no está disponible.',
      interested: transcript?.interested || false,
      sentiment: transcript?.sentiment || 'neutral',
      nextSteps: transcript?.next_steps || 'Esperando el procesamiento de Telnyx.',
      createdAt: transcript?.created_at || call.created_at,
      call: {
        id: call.id,
        status: call.status,
        durationSeconds: call.duration_seconds || 0,
        recordingUrl: call.recording_url || null,
        startedAt: call.started_at,
        direction: call.direction || 'outbound',
        agent: call.agent ? { id: call.agent.id, name: call.agent.name } : null,
        contact: call.contact ? {
          id: call.contact.id,
          fullName: call.contact.full_name,
          phone: call.contact.phone,
          company: call.contact.company,
        } : call.direction === 'inbound' ? {
          id: `caller_${call.id}`,
          fullName: 'Llamada entrante',
          phone: call.from_number || 'Número desconocido',
          company: null,
        } : null,
      },
    };
  }));
}
