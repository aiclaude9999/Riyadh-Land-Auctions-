import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, authToken, passwordEnabled, safeEqual } from '@/lib/auth';

/** Password gate: every page and API needs the session cookie when APP_PASSWORD is set. */
export async function middleware(req: NextRequest) {
  if (!passwordEnabled()) return NextResponse.next();
  const cookie = req.cookies.get(AUTH_COOKIE)?.value ?? '';
  if (cookie && safeEqual(cookie, await authToken())) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'كلمة المرور مطلوبة' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // everything except the login page/API, the health check and static files
  matcher: ['/((?!login|api/login|api/health|_next/static|_next/image|favicon.ico).*)'],
};
