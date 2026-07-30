import { NextResponse } from 'next/server';

import { testGoogleAppsScriptConnection } from '@/lib/server/calendarService';
import { requireApiAuth } from '@/lib/server/routeSecurity';

export async function POST(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  try {
    await testGoogleAppsScriptConnection();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo conectar con Google Apps Script.' },
      { status: 502 },
    );
  }
}
