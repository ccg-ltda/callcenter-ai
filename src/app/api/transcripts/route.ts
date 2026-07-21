import { NextResponse } from 'next/server';
import { mockTranscripts } from '@/lib/mockData';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { syncCallTranscript } from '@/lib/server/transcriptSync';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET() {
  if (useMockServices) return NextResponse.json(mockTranscripts);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase!
    .from('calls')
    .select('*, contact:contacts(id, full_name, phone, company), transcript:transcripts(*)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pendingCalls = (data || []).filter((call: any) => {
    const transcript = Array.isArray(call.transcript) ? call.transcript[0] : call.transcript;
    return call.status === 'completed' && (!transcript || !Array.isArray(transcript.full_transcript) || !transcript.full_transcript.length);
  }).slice(0, 10);
  const reconciled = await Promise.allSettled(pendingCalls.map(async (call: any) => {
    const result = await syncCallTranscript(call.id, { telnyxCallId: call.telnyx_call_id });
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
        contact: call.contact ? {
          id: call.contact.id,
          fullName: call.contact.full_name,
          phone: call.contact.phone,
          company: call.contact.company,
        } : null,
      },
    };
  }));
}
