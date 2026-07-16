import { NextResponse } from 'next/server';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { camelizeRow } from '@/lib/server/supabaseRows';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (useMockServices) return NextResponse.json({ id, name: 'Campaña demo', status: 'draft' });
  const { data, error } = await getSupabaseAdmin()!.from('campaigns').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Campaña no encontrada.' }, { status: 404 });
  return NextResponse.json(camelizeRow(data));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const body = await request.json();
    if (useMockServices) return NextResponse.json({ success: true, campaign: { id, ...body } });
    const allowed: Record<string, string> = { name: 'name', agentId: 'agent_id', status: 'status', totalContacts: 'total_contacts', callsMade: 'calls_made', meetingsBooked: 'meetings_booked', totalCostUsd: 'total_cost_usd', launchedAt: 'launched_at', finishedAt: 'finished_at' };
    const values = Object.fromEntries(Object.entries(body).filter(([key]) => allowed[key]).map(([key, value]) => [allowed[key], value]));
    const { data, error } = await getSupabaseAdmin()!.from('campaigns').update(values).eq('id', id).select().maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Campaña no encontrada.' }, { status: 404 });
    return NextResponse.json({ success: true, campaign: camelizeRow(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al actualizar campaña.' }, { status: 500 });
  }
}
