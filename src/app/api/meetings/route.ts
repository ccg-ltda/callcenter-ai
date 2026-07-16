import { NextResponse } from 'next/server';
import { mockMeetings } from '@/lib/mockData';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (useMockServices) return NextResponse.json(mockMeetings);
  const supabase = getSupabaseAdmin();
  let query = supabase!.from('meetings').select('*, contact:contacts(id, full_name, phone, company)').order('scheduled_at');
  if (params.get('start')) query = query.gte('scheduled_at', params.get('start')!);
  if (params.get('end')) query = query.lt('scheduled_at', params.get('end')!);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map((item: any) => ({
    id: item.id, callId: item.call_id, contactId: item.contact_id, scheduledAt: item.scheduled_at,
    durationMin: item.duration_min, googleEventId: item.google_event_id, status: item.status,
    contact: item.contact ? { id: item.contact.id, fullName: item.contact.full_name, phone: item.contact.phone, company: item.contact.company } : null,
  })));
}
