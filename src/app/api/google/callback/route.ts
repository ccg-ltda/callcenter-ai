import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCode } from '@/lib/server/calendarService';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = request.cookies.get('google_oauth_state')?.value;
  const destination = new URL('/settings', request.url);

  if (!code || !state || !expectedState || state !== expectedState) {
    destination.searchParams.set('google', 'error');
    destination.searchParams.set('message', 'La validación de seguridad OAuth falló.');
    return NextResponse.redirect(destination);
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    if (!tokens.refresh_token) throw new Error('Google no devolvió refresh token. Revoca el acceso previo y vuelve a conectar.');
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.from('settings').upsert({ id: 'default', google_calendar_connected: true, google_refresh_token: tokens.refresh_token, updated_at: new Date().toISOString() });
    if (error) throw error;
    destination.searchParams.set('google', 'connected');
  } catch (error) {
    destination.searchParams.set('google', 'error');
    destination.searchParams.set('message', error instanceof Error ? error.message : 'Error de conexión.');
  }

  const response = NextResponse.redirect(destination);
  response.cookies.delete('google_oauth_state');
  return response;
}
