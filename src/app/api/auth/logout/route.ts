import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/server/auth';
import { requireApiAuth } from '@/lib/server/routeSecurity';

export async function POST(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
