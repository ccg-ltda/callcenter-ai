import { NextResponse } from 'next/server';
import { telnyxService } from '@/lib/telnyxService';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { phoneNumber, agentId } = await request.json();
    if (!phoneNumber || !agentId) return NextResponse.json({ error: 'Faltan phoneNumber o agentId.' }, { status: 400 });
    let fromNumber = '+18005550199'; let assistantId = 'mock_assistant_123';
    if (!useMockServices) {
      const supabase = getSupabaseAdmin()!;
      const [{ data: agent }, { data: settings }] = await Promise.all([
        supabase.from('agents').select('telnyx_assistant_id').eq('id', agentId).maybeSingle(),
        supabase.from('settings').select('telnyx_phone_number, telnyx_assistant_id').eq('id', 'default').maybeSingle(),
      ]);
      if (!agent) return NextResponse.json({ error: 'Agente no encontrado.' }, { status: 404 });
      fromNumber = settings?.telnyx_phone_number || fromNumber;
      assistantId = agent.telnyx_assistant_id || settings?.telnyx_assistant_id || assistantId;
    }
    const result = await telnyxService.startCall({ phone: phoneNumber, fullName: 'Usuario de prueba' }, assistantId, fromNumber);
    if (!useMockServices && result.success) {
      const callId = result.callId || `call_${crypto.randomUUID()}`;
      await getSupabaseAdmin()!.from('calls').insert({ id: callId, telnyx_call_id: callId, status: 'ringing', started_at: new Date().toISOString(), cost_usd: 0 });
    }
    return NextResponse.json({ success: true, message: `Llamada iniciada. ID: ${result.callId}`, callId: result.callId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al iniciar llamada.' }, { status: 500 });
  }
}
