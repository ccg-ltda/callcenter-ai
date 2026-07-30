import { NextResponse } from 'next/server';
import { telnyxService } from '@/lib/telnyxService';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { requireApiAuth } from '@/lib/server/routeSecurity';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  try {
    const { id } = await params;
    const { agentId } = await request.json();
    if (!agentId) return NextResponse.json({ error: 'Selecciona un agente para llamar.' }, { status: 400 });
    if (useMockServices) {
      return NextResponse.json({ success: true, callId: `mock_call_${crypto.randomUUID()}`, message: 'Llamada simulada iniciada.' });
    }

    const supabase = getSupabaseAdmin()!;
    const [{ data: contact }, { data: agent }, { data: settings }] = await Promise.all([
      supabase.from('contacts').select('id, full_name, phone, campaign_id').eq('id', id).maybeSingle(),
      supabase.from('agents').select('name, voice, script, goal, telnyx_assistant_id').eq('id', agentId).maybeSingle(),
      supabase.from('settings').select('telnyx_phone_number, telnyx_assistant_id').eq('id', 'default').maybeSingle(),
    ]);

    if (!contact) return NextResponse.json({ error: 'Contacto no encontrado.' }, { status: 404 });
    if (!agent) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
    if (!settings?.telnyx_phone_number) {
      return NextResponse.json({ error: 'Primero configura un número Telnyx como línea saliente.' }, { status: 400 });
    }

    const currentAssistantId = agent.telnyx_assistant_id || settings.telnyx_assistant_id || '';
    const assistant = await telnyxService.createAssistant({
      name: agent.name,
      voice: agent.voice,
      script: agent.script,
      goal: agent.goal,
    }, currentAssistantId);
    const assistantId = assistant.id;
    await supabase.from('agents').update({ telnyx_assistant_id: assistantId }).eq('id', agentId);

    const result = await telnyxService.startCall(
      { phone: contact.phone, fullName: contact.full_name },
      assistantId,
      settings.telnyx_phone_number,
    );
    const callId = result.callId || `call_${crypto.randomUUID()}`;
    const { error: callError } = await supabase.from('calls').insert({
      id: callId,
      contact_id: contact.id,
      campaign_id: contact.campaign_id,
      telnyx_call_id: callId,
      status: 'ringing',
      started_at: new Date().toISOString(),
      cost_usd: 0,
    });
    if (callError) throw callError;
    await supabase.from('contacts').update({ status: 'calling' }).eq('id', contact.id);

    if (contact.campaign_id) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('calls_made')
        .eq('id', contact.campaign_id)
        .maybeSingle();
      if (campaign) {
        await supabase
          .from('campaigns')
          .update({ calls_made: (campaign.calls_made || 0) + 1 })
          .eq('id', contact.campaign_id);
      }
    }

    return NextResponse.json({ success: true, callId, message: `Llamada iniciada a ${contact.full_name}.` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al iniciar la llamada.' }, { status: 500 });
  }
}
