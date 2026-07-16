import { NextResponse } from 'next/server';

import { testGoogleAppsScriptConnection } from '@/lib/server/calendarService';

export async function POST() {
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
