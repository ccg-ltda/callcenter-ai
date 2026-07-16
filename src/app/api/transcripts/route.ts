import { NextResponse } from 'next/server';
import { mockTranscripts } from '@/lib/mockData';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET() {
  if (useMockServices) return NextResponse.json(mockTranscripts);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase!.from('transcripts').select('*, call:calls(*, contact:contacts(id, full_name, phone, company))').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map((item: any) => ({
    id: item.id, callId: item.call_id, fullTranscript: item.full_transcript || [], aiSummary: item.ai_summary,
    interested: item.interested, sentiment: item.sentiment, nextSteps: item.next_steps, createdAt: item.created_at,
    call: item.call ? { ...item.call, contact: item.call.contact ? { id: item.call.contact.id, fullName: item.call.contact.full_name, phone: item.call.contact.phone, company: item.call.contact.company } : null } : null,
  })));
}
