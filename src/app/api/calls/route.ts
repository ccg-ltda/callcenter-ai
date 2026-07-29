import { NextResponse } from 'next/server';
import { mockCalls } from '@/lib/mockData';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { camelizeRow } from '@/lib/server/supabaseRows';
import { reconcileRecentInboundCalls } from '@/lib/server/inboundCallSync';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const campaignId = params.get('campaignId'); const status = params.get('status');
  if (useMockServices) return NextResponse.json(mockCalls.filter((call) => (!campaignId || call.campaignId === campaignId) && (!status || call.status === status)));
  await reconcileRecentInboundCalls();
  let query = getSupabaseAdmin()!.from('calls').select('*, contact:contacts(id, full_name, phone, company), agent:agents(id, name)').order('created_at', { ascending: false });
  if (campaignId) query = query.eq('campaign_id', campaignId);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map((row) => {
    const mapped = camelizeRow(row);
    if (row.contact) mapped.contact = camelizeRow(row.contact as Record<string, unknown>);
    if (row.agent) mapped.agent = camelizeRow(row.agent as Record<string, unknown>);
    return mapped;
  }));
}
