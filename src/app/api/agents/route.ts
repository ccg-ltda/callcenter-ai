import { NextResponse } from 'next/server';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { camelizeRow, camelizeRows } from '@/lib/server/supabaseRows';

export async function GET() {
  if (useMockServices) return NextResponse.json([]);
  const { data, error } = await getSupabaseAdmin()!.from('agents').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(camelizeRows(data));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, voice, script, goal, meetingDurationMin, telnyxAssistantId } = body;
    if (!id || !name || !voice || !script) return NextResponse.json({ error: 'Faltan campos requeridos.' }, { status: 400 });
    if (useMockServices) return NextResponse.json({ success: true, agent: body });
    const { data, error } = await getSupabaseAdmin()!.from('agents').upsert({
      id, name, voice, script, goal: goal || 'agendar_reunion', meeting_duration_min: meetingDurationMin || 15,
      telnyx_assistant_id: telnyxAssistantId || null,
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, agent: camelizeRow(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al guardar agente.' }, { status: 500 });
  }
}
