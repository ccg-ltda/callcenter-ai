import { NextResponse } from 'next/server';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { camelizeRow, camelizeRows } from '@/lib/server/supabaseRows';
import { telnyxService } from '@/lib/telnyxService';
import { requireApiAuth } from '@/lib/server/routeSecurity';

export async function GET(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  if (useMockServices) return NextResponse.json([]);
  const { data, error } = await getSupabaseAdmin()!.from('agents').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(camelizeRows(data));
}

export async function POST(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  try {
    const body = await request.json();
    const { id, name, voice, script, goal, meetingDurationMin } = body;
    if (!id || !name || !voice || !script) return NextResponse.json({ error: 'Faltan campos requeridos.' }, { status: 400 });
    if (useMockServices) return NextResponse.json({ success: true, agent: body });
    const supabase = getSupabaseAdmin()!;
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('telnyx_assistant_id')
      .eq('id', id)
      .maybeSingle();
    const assistant = await telnyxService.createAssistant(
      { name, voice, script, goal },
      existingAgent?.telnyx_assistant_id,
    );
    const { data, error } = await supabase.from('agents').upsert({
      id, name, voice, script, goal: goal || 'agendar_reunion', meeting_duration_min: meetingDurationMin || 15,
      telnyx_assistant_id: assistant.id,
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, agent: camelizeRow(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al guardar agente.' }, { status: 500 });
  }
}
