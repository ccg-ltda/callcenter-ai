import { NextResponse } from 'next/server';
import { telnyxService } from '@/lib/telnyxService';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';

function isWithinCallWindow(start: string, end: string, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const current = `${parts.find((part) => part.type === 'hour')?.value || '00'}:${parts.find((part) => part.type === 'minute')?.value || '00'}`;
    return current >= start && current <= end;
  } catch { return true; }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (useMockServices) return NextResponse.json({ success: true, message: 'Campaña lanzada en simulación.', callsQueued: 3 });
    const supabase = getSupabaseAdmin()!;
    const [{ data: campaign }, { data: settings }] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', id).maybeSingle(),
      supabase.from('settings').select('*').eq('id', 'default').maybeSingle(),
    ]);
    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada.' }, { status: 404 });
    if (campaign.status === 'active') return NextResponse.json({ error: 'La campaña ya está activa.' }, { status: 400 });
    const start = settings?.call_window_start || '10:00'; const end = settings?.call_window_end || '18:00'; const timezone = settings?.timezone || 'America/Bogota';
    if (!isWithinCallWindow(start, end, timezone)) return NextResponse.json({ error: `Fuera de la ventana permitida (${start}–${end}, ${timezone}).` }, { status: 403 });
    if (!settings?.telnyx_phone_number) return NextResponse.json({ error: 'Configura primero el número Telnyx.' }, { status: 400 });
    const { data: agent } = campaign.agent_id ? await supabase.from('agents').select('telnyx_assistant_id').eq('id', campaign.agent_id).maybeSingle() : { data: null };
    const assistantId = agent?.telnyx_assistant_id || settings.telnyx_assistant_id;
    if (!assistantId) return NextResponse.json({ error: 'La campaña no tiene un asistente Telnyx configurado.' }, { status: 400 });

    await supabase.from('campaigns').update({ status: 'active', launched_at: new Date().toISOString() }).eq('id', id);
    const { data: contacts, error } = await supabase.from('contacts').select('*').eq('campaign_id', id).eq('status', 'pending').limit(10);
    if (error) throw error;
    let callsQueued = 0;
    for (const contact of contacts || []) {
      try {
        const result = await telnyxService.startCall({ phone: contact.phone, fullName: contact.full_name }, assistantId, settings.telnyx_phone_number);
        if (result.success) {
          const callId = result.callId || `call_${crypto.randomUUID()}`;
          await supabase.from('calls').insert({ id: callId, contact_id: contact.id, campaign_id: id, telnyx_call_id: callId, status: 'queued' });
          await supabase.from('contacts').update({ status: 'calling' }).eq('id', contact.id); callsQueued++;
        }
      } catch (error) {
        console.error(`[Campaign] Contact ${contact.id} failed`, error);
        await supabase.from('contacts').update({ status: 'failed' }).eq('id', contact.id);
      }
    }
    return NextResponse.json({ success: true, message: `Campaña lanzada. ${callsQueued} llamadas en cola.`, callsQueued });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al lanzar campaña.' }, { status: 500 });
  }
}
