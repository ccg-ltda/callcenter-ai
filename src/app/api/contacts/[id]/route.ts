import { NextResponse } from 'next/server';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { camelizeRow } from '@/lib/server/supabaseRows';
import { validatePhoneNumber } from '@/lib/phoneNumbers';
import { requireApiAuth } from '@/lib/server/routeSecurity';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  try {
    const { id } = await params;
    const body = await request.json();
    const phone = validatePhoneNumber(body.phone || '');
    if (!phone.valid) return NextResponse.json({ error: phone.error }, { status: 400 });
    if (useMockServices) {
      return NextResponse.json({ success: true, contact: { id, phone: phone.normalized, status: 'pending' } });
    }

    const supabase = getSupabaseAdmin()!;
    const { data: existing, error: findError } = await supabase
      .from('contacts')
      .select('custom_fields')
      .eq('id', id)
      .maybeSingle();
    if (findError) throw findError;
    if (!existing) return NextResponse.json({ error: 'Contacto no encontrado.' }, { status: 404 });

    const customFields = existing.custom_fields && typeof existing.custom_fields === 'object'
      ? { ...existing.custom_fields }
      : {};
    delete customFields.callError;
    const { data, error } = await supabase.from('contacts').update({
      phone: phone.normalized,
      status: 'pending',
      custom_fields: customFields,
    }).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, contact: camelizeRow(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al actualizar contacto.' }, { status: 500 });
  }
}
