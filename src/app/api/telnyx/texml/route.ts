import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';

function xmlResponse(content: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[character] || character);
}

async function requestParameters(request: Request) {
  const url = new URL(request.url);
  if (request.method === 'GET') return url.searchParams;
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await request.json();
    const params = new URLSearchParams();
    Object.entries(body || {}).forEach(([key, value]) => {
      if (typeof value === 'string') params.set(key, value);
    });
    return params;
  }
  return new URLSearchParams(await request.text());
}

async function handleInboundCall(request: Request) {
  try {
    const params = await requestParameters(request);
    const callId = params.get('CallSid') || params.get('CallSidLegacy') || '';
    const fromNumber = params.get('From') || '';
    const toNumber = params.get('To') || '';

    if (useMockServices) {
      return xmlResponse('<Connect><AIAssistant id="mock_assistant_123"></AIAssistant></Connect>');
    }

    const supabase = getSupabaseAdmin()!;
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('telnyx_phone_number, inbound_agent_id')
      .eq('id', 'default')
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings?.inbound_agent_id) {
      return xmlResponse('<Say language="es-CO">Esta línea todavía no tiene un agente asignado.</Say><Hangup />');
    }

    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('telnyx_assistant_id')
      .eq('id', settings.inbound_agent_id)
      .maybeSingle();
    if (agentError) throw agentError;
    if (!agent?.telnyx_assistant_id) {
      return xmlResponse('<Say language="es-CO">El agente de esta línea no está disponible.</Say><Hangup />');
    }

    if (callId) {
      const { error: callError } = await supabase.from('calls').upsert({
        id: callId,
        telnyx_call_id: callId,
        agent_id: settings.inbound_agent_id,
        direction: 'inbound',
        from_number: fromNumber || null,
        to_number: toNumber || settings.telnyx_phone_number || null,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (callError) throw callError;
    }

    return xmlResponse(
      `<Connect><AIAssistant id="${escapeXml(agent.telnyx_assistant_id)}"></AIAssistant></Connect>`,
    );
  } catch (error) {
    console.error('[Telnyx TeXML inbound]', error);
    return xmlResponse('<Say language="es-CO">No pudimos conectar la llamada. Intenta nuevamente más tarde.</Say><Hangup />');
  }
}

export const POST = handleInboundCall;
export const GET = handleInboundCall;
