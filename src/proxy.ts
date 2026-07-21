import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/server/auth';

const PUBLIC_PATHS = new Set([
  '/login',
  '/api/auth/login',
  '/api/telnyx/webhook',
  '/api/telnyx/texml',
]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = verifySessionToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (pathname === '/login' && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (!isAuthenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado. Inicia sesión nuevamente.' }, { status: 401 });
    }

    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
