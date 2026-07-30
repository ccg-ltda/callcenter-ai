import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';

import { getGoogleAuthorizationUrl } from '@/lib/server/calendarService';
import { requireApiAuth } from '@/lib/server/routeSecurity';

export async function GET(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  if (process.env.NEXT_PUBLIC_USE_MOCK_SERVICES === 'true') {
    return NextResponse.redirect(new URL('/settings?google=connected', process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000'));
  }

  try {
    const state = randomBytes(24).toString('hex');
    const response = NextResponse.redirect(getGoogleAuthorizationUrl(state));
    response.cookies.set('google_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/' });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo iniciar OAuth.';
    return NextResponse.redirect(new URL(`/settings?google=error&message=${encodeURIComponent(message)}`, 'http://localhost:3000'));
  }
}
