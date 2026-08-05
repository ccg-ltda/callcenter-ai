import { NextResponse } from 'next/server';
import { dispatchCampaignCalls } from '@/lib/server/campaignDispatcher';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { requireApiAuth } from '@/lib/server/routeSecurity';

function isWithinCallWindow(start: string, end: string, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const current = `${parts.find((part) => part.type === 'hour')?.value || '00'}:${parts.find((part) => part.type === 'minute')?.value || '00'}`;
    return current >= start && current <= end;
  } catch {
    return true;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    if (useMockServices) {
      return NextResponse.json({
        success: true,
        message: 'Campaña lanzada en simulación respetando el límite de concurrencia.',
        callsQueued: 1,
      });
    }

    const supabase = getSupabaseAdmin()!;
    const [{ data: campaign, error: campaignError }, { data: settings, error: settingsError }] = await Promise.all([
      supabase.from('campaigns').select('id').eq('id', id).maybeSingle(),
      supabase
        .from('settings')
        .select('call_window_start, call_window_end, timezone')
        .eq('id', 'default')
        .maybeSingle(),
    ]);
    if (campaignError) throw campaignError;
    if (settingsError) throw settingsError;
    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada.' }, { status: 404 });

    const start = settings?.call_window_start || '10:00';
    const end = settings?.call_window_end || '18:00';
    const timezone = settings?.timezone || 'America/Bogota';
    if (!isWithinCallWindow(start, end, timezone)) {
      return NextResponse.json({
        error: `Fuera de la ventana permitida (${start}–${end}, ${timezone}).`,
      }, { status: 403 });
    }

    // A manual launch is also the explicit retry action exposed by the UI.
    // Failed contacts become eligible again, while completed contacts never do.
    const { error: retryError } = await supabase
      .from('contacts')
      .update({ status: 'pending' })
      .eq('campaign_id', id)
      .eq('status', 'failed');
    if (retryError) throw retryError;

    const { error: updateError } = await supabase.from('campaigns').update({
      status: 'active',
      launched_at: new Date().toISOString(),
      finished_at: null,
    }).eq('id', id);
    if (updateError) throw updateError;

    const { callsQueued, failedCalls } = await dispatchCampaignCalls(id, { refreshAssistant: true });
    const failedMessage = failedCalls.length
      ? ` ${failedCalls.length} contacto(s) con error; revisa el detalle.`
      : '';

    return NextResponse.json({
      success: true,
      message: `Campaña iniciada. ${callsQueued} llamadas activadas respetando el límite configurado.${failedMessage}`,
      callsQueued,
      failedCalls,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error al lanzar campaña.',
    }, { status: 500 });
  }
}
