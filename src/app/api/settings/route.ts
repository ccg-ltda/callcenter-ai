import { NextResponse } from 'next/server';
import { camelizeRow } from '@/lib/server/supabaseRows';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { isGoogleAppsScriptConfigured } from '@/lib/server/calendarService';
import { requireApiAuth } from '@/lib/server/routeSecurity';

const defaults = {
  id: 'default', telnyx_phone_number: '', telnyx_assistant_id: '', inbound_agent_id: null, google_calendar_connected: false,
  call_window_start: '10:00', call_window_end: '18:00', timezone: 'America/Bogota',
};

function safeSettings(row: Record<string, unknown>) {
  const { google_refresh_token, telnyx_api_key, ...safe } = row;
  void google_refresh_token;
  void telnyx_api_key;
  const appsScriptConfigured = isGoogleAppsScriptConfigured();
  const oauthConnected = Boolean(safe.google_calendar_connected);
  return {
    ...camelizeRow(safe),
    googleCalendarConnected: appsScriptConfigured || oauthConnected,
    googleCalendarProvider: appsScriptConfigured ? 'apps-script' : oauthConnected ? 'oauth' : null,
    telnyxApiKeyConfigured: Boolean(process.env.TELNYX_API_KEY),
  };
}

export async function GET(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  if (useMockServices) return NextResponse.json({ ...camelizeRow(defaults), googleCalendarProvider: 'mock', telnyxApiKeyConfigured: true });
  const supabase = getSupabaseAdmin()!;
  let { data, error } = await supabase.from('settings').select('*').eq('id', 'default').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    const inserted = await supabase.from('settings').insert(defaults).select().single();
    data = inserted.data; error = inserted.error;
  }
  if (error || !data) return NextResponse.json({ error: error?.message || 'No se pudo crear settings.' }, { status: 500 });
  return NextResponse.json(safeSettings(data));
}

export async function POST(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  try {
    const body = await request.json();
    if (useMockServices) return NextResponse.json({ success: true, settings: body });
    const values: Record<string, unknown> = { id: 'default', updated_at: new Date().toISOString() };
    if (body.telnyxPhoneNumber !== undefined) values.telnyx_phone_number = body.telnyxPhoneNumber;
    if (body.telnyxAssistantId !== undefined) values.telnyx_assistant_id = body.telnyxAssistantId;
    if (body.inboundAgentId !== undefined) values.inbound_agent_id = body.inboundAgentId || null;
    if (body.googleCalendarConnected !== undefined) values.google_calendar_connected = body.googleCalendarConnected;
    if (body.callWindowStart !== undefined) values.call_window_start = body.callWindowStart;
    if (body.callWindowEnd !== undefined) values.call_window_end = body.callWindowEnd;
    if (body.timezone !== undefined) values.timezone = body.timezone;
    const { data, error } = await getSupabaseAdmin()!.from('settings').upsert(values).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, settings: safeSettings(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al guardar settings.' }, { status: 500 });
  }
}
