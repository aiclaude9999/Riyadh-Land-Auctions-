'use client';
import { useEffect, useState } from 'react';

// One shared 1-second ticker for every countdown on the page (no network calls).
const subs = new Set<(n: number) => void>();
let timer: ReturnType<typeof setInterval> | null = null;
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    subs.add(setNow);
    if (!timer) timer = setInterval(() => { const n = Date.now(); subs.forEach((f) => f(n)); }, 1000);
    return () => { subs.delete(setNow); if (!subs.size && timer) { clearInterval(timer); timer = null; } };
  }, []);
  return now;
}

export function Countdown({ to, compact }: { to: string; compact?: boolean }) {
  const now = useNow();
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return <span className="muted text-xs">انتهى الوقت المسجل</span>;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const urgent = ms < 3_600_000;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className={`num font-semibold ${urgent ? 'text-red-600' : 'text-brand-600'} ${compact ? 'text-sm' : 'text-base'}`}>
      {d > 0 && <span>{d} يوم </span>}
      <span dir="ltr">{pad(h)}:{pad(m)}:{pad(sec)}</span>
    </span>
  );
}
