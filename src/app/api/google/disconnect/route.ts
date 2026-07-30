import { NextResponse } from 'next/server';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { requireApiAuth } from '@/lib/server/routeSecurity';

export async function POST(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  if (useMockServices) return NextResponse.json({ success: true });
  const supabase = getSupabaseAdmin();
  const { error } = await supabase!.from('settings').update({ google_calendar_connected: false, google_refresh_token: null, updated_at: new Date().toISOString() }).eq('id', 'default');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
