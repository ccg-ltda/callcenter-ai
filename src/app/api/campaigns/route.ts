import { NextResponse } from 'next/server';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { camelizeRow, camelizeRows } from '@/lib/server/supabaseRows';

export async function GET() {
  if (useMockServices) return NextResponse.json([]);
  const { data, error } = await getSupabaseAdmin()!.from('campaigns').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(camelizeRows(data));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.id || !body.name) return NextResponse.json({ error: 'Faltan id o name.' }, { status: 400 });
    if (useMockServices) return NextResponse.json({ success: true, campaign: body });
    const { data, error } = await getSupabaseAdmin()!.from('campaigns').upsert({
      id: body.id, name: body.name, agent_id: body.agentId || null, status: body.status || 'draft',
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, campaign: camelizeRow(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al guardar campaña.' }, { status: 500 });
  }
}
