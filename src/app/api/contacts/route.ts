import { NextResponse } from 'next/server';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { camelizeRows } from '@/lib/server/supabaseRows';

type ImportedContact = { fullName?: string; nombre?: string; name?: string; phone?: string; telefono?: string; tel?: string; company?: string; empresa?: string; customFields?: unknown };

export async function GET(request: Request) {
  if (useMockServices) return NextResponse.json([]);
  const campaignId = new URL(request.url).searchParams.get('campaignId');
  let query = getSupabaseAdmin()!.from('contacts').select('*').order('created_at', { ascending: false });
  if (campaignId) query = query.eq('campaign_id', campaignId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(camelizeRows(data));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const campaignId = body.campaignId as string;
    const list = body.contacts as ImportedContact[];
    if (!campaignId || !Array.isArray(list) || !list.length) return NextResponse.json({ error: 'Faltan campaignId o contacts[].' }, { status: 400 });
    const values = list.map((contact, index) => ({
      id: `c_${Date.now()}_${index}`, campaign_id: campaignId,
      full_name: contact.fullName || contact.nombre || contact.name || 'Sin nombre',
      phone: contact.phone || contact.telefono || contact.tel || '', company: contact.company || contact.empresa || null,
      custom_fields: contact.customFields || null, status: 'pending',
    })).filter((contact) => contact.phone);
    if (!values.length) return NextResponse.json({ error: 'Ningún contacto tiene teléfono válido.' }, { status: 400 });
    if (useMockServices) return NextResponse.json({ success: true, imported: values.length, failed: list.length - values.length, contacts: camelizeRows(values) });
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.from('contacts').insert(values).select();
    if (error) throw error;
    const { count } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('campaign_id', campaignId);
    await supabase.from('campaigns').update({ total_contacts: count || 0 }).eq('id', campaignId);
    return NextResponse.json({ success: true, imported: data.length, failed: list.length - values.length, contacts: camelizeRows(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al importar contactos.' }, { status: 500 });
  }
}
