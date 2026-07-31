import { NextResponse } from 'next/server';
import { telnyxService } from '@/lib/telnyxService';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { requireApiAuth } from '@/lib/server/routeSecurity';

function isWithinCallWindow(start: string, end: string, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const current = `${parts.find((part) => part.type === 'hour')?.value || '00'}:${parts.find((part) => part.type === 'minute')?.value || '00'}`;
    return current >= start && current <= end;
  } catch { return true; }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  try {
    const { id } = await params;
    if (useMockServices) return NextResponse.json({ success: true, message: 'Campaña lanzada en simulación.', callsQueued: 3 });
    const supabase = getSupabaseAdmin()!;
    const [{ data: campaign }, { data: settings }] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', id).maybeSingle(),
      supabase.from('settings').select('*').eq('id', 'default').maybeSingle(),
    ]);
    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada.' }, { status: 404 });
    const start = settings?.call_window_start || '10:00'; const end = settings?.call_window_end || '18:00'; const timezone = settings?.timezone || 'America/Bogota';
    if (!isWithinCallWindow(start, end, timezone)) return NextResponse.json({ error: `Fuera de la ventana permitida (${start}–${end}, ${timezone}).` }, { status: 403 });
    const outboundPhoneNumber = campaign.outbound_phone_number || settings?.telnyx_phone_number;
    if (!outboundPhoneNumber) return NextResponse.json({ error: 'Configura primero el número Telnyx.' }, { status: 400 });
    const { data: agent } = campaign.agent_id
      ? await supabase.from('agents').select('name, voice, script, goal, telnyx_assistant_id').eq('id', campaign.agent_id).maybeSingle()
      : { data: null };
    let assistantId = agent?.telnyx_assistant_id || settings.telnyx_assistant_id;
    if (!assistantId) return NextResponse.json({ error: 'La campaña no tiene un asistente Telnyx configurado.' }, { status: 400 });
    if (agent) {
      const assistant = await telnyxService.createAssistant({
        name: agent.name,
        voice: agent.voice,
        script: agent.script,
        goal: agent.goal,
      }, assistantId);
      assistantId = assistant.id;
      await supabase.from('agents').update({ telnyx_assistant_id: assistantId }).eq('id', campaign.agent_id);
    }

    await supabase.from('campaigns').update({
      status: 'active',
      launched_at: new Date().toISOString(),
      finished_at: null,
    }).eq('id', id);
    const { data: contacts, error } = await supabase.from('contacts').select('*').eq('campaign_id', id).in('status', ['pending', 'failed']).limit(10);
    if (error) throw error;
    let callsQueued = 0;
    const failedCalls: Array<{ contactId: string; name: string; error: string }> = [];
    for (const contact of contacts || []) {
      try {
        const result = await telnyxService.startCall({ phone: contact.phone, fullName: contact.full_name }, assistantId, outboundPhoneNumber);
        if (result.success) {
          const callId = result.callId || `call_${crypto.randomUUID()}`;
          await supabase.from('calls').insert({
            id: callId,
            contact_id: contact.id,
            campaign_id: id,
            agent_id: campaign.agent_id,
            telnyx_call_id: callId,
            direction: 'outbound',
            from_number: outboundPhoneNumber,
            to_number: contact.phone,
            status: 'queued',
          });
          await supabase.from('contacts').update({ status: 'calling' }).eq('id', contact.id); callsQueued++;
        }
      } catch (error) {
        console.error(`[Campaign] Contact ${contact.id} failed`, error);
        const message = error instanceof Error ? error.message : 'Telnyx rechazó la llamada.';
        const customFields = contact.custom_fields && typeof contact.custom_fields === 'object'
          ? { ...contact.custom_fields, callError: message }
          : { callError: message };
        await supabase.from('contacts').update({ status: 'failed', custom_fields: customFields }).eq('id', contact.id);
        failedCalls.push({ contactId: contact.id, name: contact.full_name, error: message });
      }
    }
    const failedMessage = failedCalls.length ? ` ${failedCalls.length} contacto(s) con error; revisa el detalle.` : '';
    return NextResponse.json({
      success: true,
      message: `Campaña procesada. ${callsQueued} llamadas en cola.${failedMessage}`,
      callsQueued,
      failedCalls,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al lanzar campaña.' }, { status: 500 });
  }
}
