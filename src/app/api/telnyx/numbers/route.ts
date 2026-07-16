import { NextResponse } from 'next/server';
import { telnyxService } from '@/lib/telnyxService';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const country = params.get('country') || 'CO';
    const city = params.get('city') || '';
    return NextResponse.json(await telnyxService.searchNumbers(country, city));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al buscar números.' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const { phoneNumber } = await request.json();
    if (!phoneNumber) return NextResponse.json({ error: 'phoneNumber es requerido.' }, { status: 400 });
    return NextResponse.json(await telnyxService.buyNumber(phoneNumber));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al comprar número.' }, { status: 502 });
  }
}
