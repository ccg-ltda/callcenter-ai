import { NextResponse } from 'next/server';
import { normalizePhoneNumber } from '@/lib/phoneNumbers';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { requireApiAuth } from '@/lib/server/routeSecurity';
import { telnyxService } from '@/lib/telnyxService';

function isMissingInventoryTable(error: { code?: string } | null) {
  return Boolean(error && ['42P01', 'PGRST205'].includes(error.code || ''));
}

export async function GET(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  try {
    if (useMockServices) {
      return NextResponse.json({
        defaultOutboundNumber: '+18005550199',
        migrationRequired: false,
        numbers: [{
          phoneNumber: '+18005550199',
          status: 'active',
          inboundAgentId: '',
          isDefaultOutbound: true,
        }],
      });
    }

    const supabase = getSupabaseAdmin()!;
    const [ownedNumbers, settingsResult] = await Promise.all([
      telnyxService.listOwnedNumbers(),
      supabase
        .from('settings')
        .select('telnyx_phone_number, inbound_agent_id')
        .eq('id', 'default')
        .maybeSingle(),
    ]);
    if (settingsResult.error) throw settingsResult.error;

    const inventoryResult = await supabase
      .from('phone_numbers')
      .select('phone_number, inbound_agent_id, status');

    if (isMissingInventoryTable(inventoryResult.error)) {
      const defaultNumber = settingsResult.data?.telnyx_phone_number || '';
      const activeDefaultNumber = ownedNumbers.some((number) =>
        number.phoneNumber === defaultNumber && number.status === 'active')
        ? defaultNumber
        : '';
      return NextResponse.json({
        defaultOutboundNumber: activeDefaultNumber,
        migrationRequired: true,
        numbers: ownedNumbers.map((number) => ({
          ...number,
          inboundAgentId: number.phoneNumber === defaultNumber
            ? settingsResult.data?.inbound_agent_id || ''
            : '',
          isDefaultOutbound: number.phoneNumber === defaultNumber,
        })),
      });
    }
    if (inventoryResult.error) throw inventoryResult.error;

    if (ownedNumbers.length) {
      const { error: syncError } = await supabase.from('phone_numbers').upsert(
        ownedNumbers.map((number) => ({
          phone_number: number.phoneNumber,
          telnyx_id: number.id,
          status: number.status,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'phone_number', ignoreDuplicates: false },
      );
      if (syncError) throw syncError;
    }

    const { data: configurations, error: configurationError } = await supabase
      .from('phone_numbers')
      .select('phone_number, inbound_agent_id, status');
    if (configurationError) throw configurationError;

    const configurationByNumber = new Map(
      (configurations || []).map((row) => [row.phone_number, row]),
    );
    const defaultNumber = settingsResult.data?.telnyx_phone_number || '';
    const activeDefaultNumber = ownedNumbers.some((number) =>
      number.phoneNumber === defaultNumber && number.status === 'active')
      ? defaultNumber
      : '';
    const visibleNumbers = [...ownedNumbers];
    for (const configuration of configurations || []) {
      if (
        configuration.status !== 'active' &&
        !visibleNumbers.some((number) => number.phoneNumber === configuration.phone_number)
      ) {
        visibleNumbers.push({
          id: '',
          phoneNumber: configuration.phone_number,
          status: configuration.status || 'pending',
          connectionId: null,
        });
      }
    }

    return NextResponse.json({
      defaultOutboundNumber: activeDefaultNumber,
      migrationRequired: false,
      numbers: visibleNumbers.map((number) => {
        const configuration = configurationByNumber.get(number.phoneNumber);
        return {
          ...number,
          status: configuration?.status || number.status,
          inboundAgentId: configuration?.inbound_agent_id || '',
          isDefaultOutbound: number.phoneNumber === defaultNumber,
        };
      }),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'No se pudo consultar el inventario de números.',
    }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const phoneNumber = normalizePhoneNumber(body.phoneNumber || '');
    if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
      return NextResponse.json({ error: 'Selecciona un número Telnyx válido.' }, { status: 400 });
    }
    if (body.action !== 'set-default-outbound') {
      return NextResponse.json({ error: 'Acción no soportada.' }, { status: 400 });
    }

    if (!useMockServices) {
      const ownedNumbers = await telnyxService.listOwnedNumbers();
      if (!ownedNumbers.some((number) =>
        number.phoneNumber === phoneNumber && number.status === 'active')) {
        return NextResponse.json({ error: 'El número no pertenece a la cuenta Telnyx.' }, { status: 403 });
      }
      const { error } = await getSupabaseAdmin()!.from('settings').upsert({
        id: 'default',
        telnyx_phone_number: phoneNumber,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    }

    return NextResponse.json({ success: true, defaultOutboundNumber: phoneNumber });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'No se pudo seleccionar el número saliente.',
    }, { status: 500 });
  }
}
