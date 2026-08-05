import { NextResponse } from 'next/server';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { camelizeRow, camelizeRows } from '@/lib/server/supabaseRows';
import { requireApiAuth } from '@/lib/server/routeSecurity';

export async function GET(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  if (useMockServices) return NextResponse.json([]);
  const { data, error } = await getSupabaseAdmin()!.from('campaigns').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(camelizeRows(data));
}

export async function POST(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  try {
    const body = await request.json();
    if (!body.id || !body.name) return NextResponse.json({ error: 'Faltan id o name.' }, { status: 400 });
    const maxConcurrentCalls = Number(body.maxConcurrentCalls ?? 1);
    if (!Number.isInteger(maxConcurrentCalls) || maxConcurrentCalls < 1 || maxConcurrentCalls > 50) {
      return NextResponse.json({ error: 'Las llamadas simultáneas deben ser un número entero entre 1 y 50.' }, { status: 400 });
    }
    if (useMockServices) return NextResponse.json({ success: true, campaign: body });
    const supabase = getSupabaseAdmin()!;
    if (body.outboundPhoneNumber) {
      const { data: ownedNumber, error: numberError } = await supabase
        .from('phone_numbers')
        .select('phone_number, status')
        .eq('phone_number', body.outboundPhoneNumber)
        .eq('status', 'active')
        .maybeSingle();
      if (numberError) throw numberError;
      if (!ownedNumber) {
        return NextResponse.json({ error: 'El número saliente no pertenece al inventario.' }, { status: 400 });
      }
    }
    const { data, error } = await supabase.from('campaigns').upsert({
      id: body.id,
      name: body.name,
      agent_id: body.agentId || null,
      outbound_phone_number: body.outboundPhoneNumber || null,
      max_concurrent_calls: maxConcurrentCalls,
      status: body.status || 'draft',
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, campaign: camelizeRow(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al guardar campaña.' }, { status: 500 });
  }
}
