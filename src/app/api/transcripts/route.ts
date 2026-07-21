import { NextResponse } from 'next/server';
import { mockTranscripts } from '@/lib/mockData';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';

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
  return NextResponse.json((data || []).map((call: any) => {
    const transcript = Array.isArray(call.transcript) ? call.transcript[0] : call.transcript;
    return {
      id: transcript?.id || `pending_${call.id}`,
      callId: call.id,
      hasTranscript: Boolean(transcript),
      fullTranscript: transcript?.full_transcript || [],
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
