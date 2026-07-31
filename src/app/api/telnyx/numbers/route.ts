import { NextResponse } from 'next/server';
import { telnyxService } from '@/lib/telnyxService';
import { requireApiAuth } from '@/lib/server/routeSecurity';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';

export async function GET(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  try {
    const params = new URL(request.url).searchParams;
    const country = params.get('country') || 'CO';
    const city = params.get('city') || '';
    const administrativeArea = params.get('administrativeArea') || '';
    return NextResponse.json(await telnyxService.searchNumbers(country, city, administrativeArea));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al buscar números.' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  try {
    const { phoneNumber } = await request.json();
    if (!phoneNumber) return NextResponse.json({ error: 'phoneNumber es requerido.' }, { status: 400 });
    if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
      return NextResponse.json({
        error: 'Telnyx devolvió un número oculto que no se puede comprar. Agrega un método de pago y verifica tu cuenta en Telnyx para desbloquear números completos.',
      }, { status: 400 });
    }
    const result = await telnyxService.buyNumber(phoneNumber);
    if (!useMockServices) {
      const supabase = getSupabaseAdmin()!;
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('telnyx_phone_number')
        .eq('id', 'default')
        .maybeSingle();
      if (settingsError) throw settingsError;

      const { error: inventoryError } = await supabase.from('phone_numbers').upsert({
        phone_number: phoneNumber,
        status: result.status || 'pending',
        updated_at: new Date().toISOString(),
      });
      if (inventoryError && !['42P01', 'PGRST205'].includes(inventoryError.code || '')) {
        throw inventoryError;
      }
      if (!settings?.telnyx_phone_number) {
        const { error: defaultError } = await supabase.from('settings').upsert({
          id: 'default',
          telnyx_phone_number: phoneNumber,
          updated_at: new Date().toISOString(),
        });
        if (defaultError) throw defaultError;
      }
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al comprar número.' }, { status: 502 });
  }
}
