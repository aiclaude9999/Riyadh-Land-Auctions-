'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (r.ok) {
      const next = new URLSearchParams(location.search).get('next');
      location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    } else {
      setErr((await r.json().catch(() => null))?.error ?? 'تعذر تسجيل الدخول');
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-2xl text-white">◎</div>
          <h1 className="mt-3 text-xl font-bold">رادار المزادات</h1>
          <p className="muted text-sm">أدخل كلمة المرور للدخول</p>
        </div>
        <input id="password" type="password" autoFocus autoComplete="current-password" className="input" placeholder="كلمة المرور" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn btn-primary w-full justify-center" disabled={busy || !pw}>{busy ? '...' : 'دخول'}</button>
      </form>
    </div>
  );
}
