import { NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  AUTH_SESSION_MAX_AGE,
  createSessionToken,
  getAuthConfigurationIssue,
  verifyCredentials,
} from '@/lib/server/auth';
import {
  checkRateLimit,
  requestClientAddress,
  resetRateLimit,
} from '@/lib/server/rateLimit';
import { requireSameOrigin } from '@/lib/server/routeSecurity';

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const configurationIssue = getAuthConfigurationIssue();
  if (configurationIssue) {
    return NextResponse.json({ error: configurationIssue }, { status: 503 });
  }

  const clientAddress = requestClientAddress(request);
  const addressLimit = await checkRateLimit('login-ip', clientAddress, 10, 15 * 60);
  if (!addressLimit.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Intenta nuevamente más tarde.' },
      {
        status: 429,
        headers: { 'Retry-After': String(addressLimit.retryAfter) },
      },
    );
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const normalizedUsername = username.trim().toLowerCase().slice(0, 200);
  const accountLimit = await checkRateLimit(
    'login-account',
    normalizedUsername || 'empty',
    6,
    15 * 60,
  );
  if (!accountLimit.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Intenta nuevamente más tarde.' },
      {
        status: 429,
        headers: { 'Retry-After': String(accountLimit.retryAfter) },
      },
    );
  }

  if (!verifyCredentials(username, password)) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
  }

  await Promise.all([
    resetRateLimit('login-ip', clientAddress),
    resetRateLimit('login-account', normalizedUsername),
  ]);

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
