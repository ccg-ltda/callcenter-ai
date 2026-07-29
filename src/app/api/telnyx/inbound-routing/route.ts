import { NextResponse } from 'next/server';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { telnyxService } from '@/lib/telnyxService';

export async function GET() {
  if (useMockServices) {
    return NextResponse.json({ phoneNumber: '+18005550199', inboundAgentId: '' });
  }

  const { data, error } = await getSupabaseAdmin()!
    .from('settings')
    .select('telnyx_phone_number, inbound_agent_id')
    .eq('id', 'default')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    phoneNumber: data?.telnyx_phone_number || '',
    inboundAgentId: data?.inbound_agent_id || '',
  });
}

export async function PUT(request: Request) {
  try {
    const { agentId } = await request.json();
    if (typeof agentId !== 'string' || !agentId) {
      return NextResponse.json({ error: 'Selecciona un agente para atender el número.' }, { status: 400 });
    }
    if (useMockServices) {
      return NextResponse.json({ success: true, inboundAgentId: agentId });
    }

    const supabase = getSupabaseAdmin()!;
    const [{ data: settings, error: settingsError }, { data: agent, error: agentError }] = await Promise.all([
      supabase.from('settings').select('telnyx_phone_number').eq('id', 'default').maybeSingle(),
      supabase.from('agents').select('id, name, voice, script, goal, telnyx_assistant_id').eq('id', agentId).maybeSingle(),
    ]);
    if (settingsError) throw settingsError;
    if (agentError) throw agentError;
    if (!settings?.telnyx_phone_number) {
      return NextResponse.json({ error: 'Primero compra o configura un número Telnyx.' }, { status: 400 });
    }
    if (!agent) {
      return NextResponse.json({ error: 'El agente seleccionado ya no existe.' }, { status: 404 });
    }

    const assistant = await telnyxService.createAssistant({
      name: agent.name,
      voice: agent.voice,
      script: agent.script,
      goal: agent.goal || undefined,
    }, agent.telnyx_assistant_id);

    await telnyxService.assignNumberToTexmlApplication(settings.telnyx_phone_number);

    const { error: agentUpdateError } = await supabase
      .from('agents')
      .update({ telnyx_assistant_id: assistant.id })
      .eq('id', agentId);
    if (agentUpdateError) throw agentUpdateError;

    const { error: settingsUpdateError } = await supabase
      .from('settings')
      .upsert({
        id: 'default',
        inbound_agent_id: agentId,
        updated_at: new Date().toISOString(),
      });
    if (settingsUpdateError) throw settingsUpdateError;

    return NextResponse.json({
      success: true,
      inboundAgentId: agentId,
      phoneNumber: settings.telnyx_phone_number,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'No se pudo activar la recepción de llamadas.',
    }, { status: 500 });
  }
}
