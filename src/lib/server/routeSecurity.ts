import 'server-only';

import { NextResponse } from 'next/server';

import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/server/auth';

function cookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie') || '';
  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');
    if (separator === -1) continue;
    const key = item.slice(0, separator).trim();
    if (key === name) return item.slice(separator + 1).trim();
  }
  return undefined;
}

function hasValidOrigin(request: Request) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return true;

  const origin = request.headers.get('origin');
  if (!origin) return true;

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host');
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function requireApiAuth(request: Request) {
  const token = cookieValue(request, AUTH_COOKIE_NAME);
  if (!verifySessionToken(token)) {
    return NextResponse.json(
      { error: 'No autorizado. Inicia sesión nuevamente.' },
      { status: 401 },
    );
  }

  if (!hasValidOrigin(request)) {
    return NextResponse.json(
      { error: 'Origen de solicitud no permitido.' },
      { status: 403 },
    );
  }

  return null;
}

export function requireSameOrigin(request: Request) {
  if (hasValidOrigin(request)) return null;
  return NextResponse.json(
    { error: 'Origen de solicitud no permitido.' },
    { status: 403 },
  );
}
