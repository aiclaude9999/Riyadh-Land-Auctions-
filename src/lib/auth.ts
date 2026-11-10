/**
 * Simple site-wide password (set APP_PASSWORD). Works in Edge middleware and Node routes (Web Crypto).
 * The cookie holds an HMAC derived from the password, so changing APP_PASSWORD logs everyone out.
 */
export const AUTH_COOKIE = 'mr_auth';

export function passwordEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

export async function authToken(password = process.env.APP_PASSWORD ?? ''): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('mazad-radar-session-v1'));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
