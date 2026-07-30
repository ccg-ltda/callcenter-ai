import { NextResponse } from 'next/server';
import { telnyxService } from '@/lib/telnyxService';
import { requireApiAuth } from '@/lib/server/routeSecurity';

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
    return NextResponse.json(await telnyxService.buyNumber(phoneNumber));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al comprar número.' }, { status: 502 });
  }
}
