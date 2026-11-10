import { NextResponse } from 'next/server';
import { AUTH_COOKIE, authToken, passwordEnabled, safeEqual } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!passwordEnabled()) return NextResponse.json({ ok: true });
  const { password } = await req.json().catch(() => ({ password: '' }));
  const ok = typeof password === 'string' && safeEqual(await authToken(password), await authToken());
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await authToken(), {
    httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}
