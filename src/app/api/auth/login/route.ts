import { NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  AUTH_SESSION_MAX_AGE,
  createSessionToken,
  getAuthConfigurationIssue,
  verifyCredentials,
} from '@/lib/server/auth';

export async function POST(request: Request) {
  const configurationIssue = getAuthConfigurationIssue();
  if (configurationIssue) {
    return NextResponse.json({ error: configurationIssue }, { status: 503 });
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!verifyCredentials(username, password)) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_SESSION_MAX_AGE,
    priority: 'high',
  });
  return response;
}
