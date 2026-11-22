'use client';

import { useEffect, useRef, useState } from 'react';

export type Snap = 'peek' | 'half' | 'full';
const HEIGHT: Record<Snap, number> = { peek: 0.26, half: 0.56, full: 0.92 }; // share of the screen height

/** True on phone-sized screens (the panel becomes a pull-up sheet over a full-screen map). */
export function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}

/** Height of the sheet in px for a snap point (for map padding). */
export const sheetPx = (snap: Snap) => (typeof window === 'undefined' ? 0 : Math.round(window.innerHeight * HEIGHT[snap]));

/**
 * Phones: a sheet over the map, dragged by its handle between three heights (like Google Maps).
 * Larger screens: a normal side panel. `top` stays above the scrolling content, `footer` is sticky.
 */
export default function BottomSheet({
  mobile,
  snap,
  onSnap,
  top,
  footer,
  children,
}: {
  mobile: boolean;
  snap: Snap;
  onSnap: (s: Snap) => void;
  top: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const [drag, setDrag] = useState<number | null>(null); // current height while dragging (px)
  const start = useRef<{ y: number; h: number } | null>(null);

  if (!mobile) {
    return (
      <aside className="flex min-h-0 w-[440px] flex-none flex-col border-e border-sand-dark bg-sand">
        {top}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        <div className="border-t border-sand-dark bg-white/80 px-4 py-3 backdrop-blur">{footer}</div>
      </aside>
    );
  }

  const height = drag ?? sheetPx(snap);
  const end = () => {
    if (drag == null) return;
    const vh = window.innerHeight;
    const nearest = (Object.keys(HEIGHT) as Snap[]).reduce((a, b) => (Math.abs(HEIGHT[b] * vh - drag) < Math.abs(HEIGHT[a] * vh - drag) ? b : a));
    setDrag(null);
    start.current = null;
    onSnap(nearest);
  };

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-[1200] flex flex-col rounded-t-3xl bg-sand shadow-sheet"
      style={{ height, transition: drag == null ? 'height 220ms ease' : 'none' }}
    >
      <div
        role="slider"
        aria-label="panel size"
        aria-valuenow={Math.round((height / window.innerHeight) * 100)}
        tabIndex={0}
        className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          start.current = { y: e.clientY, h: height };
          setDrag(height);
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const h = start.current.h + (start.current.y - e.clientY);
          setDrag(Math.max(window.innerHeight * 0.18, Math.min(window.innerHeight * 0.95, h)));
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={(e) => {
          const order: Snap[] = ['peek', 'half', 'full'];
          const i = order.indexOf(snap);
          if (e.key === 'ArrowUp' && i < 2) onSnap(order[i + 1]);
          if (e.key === 'ArrowDown' && i > 0) onSnap(order[i - 1]);
        }}
        onDoubleClick={() => onSnap(snap === 'full' ? 'half' : 'full')}
      >
        <span className="h-1.5 w-12 rounded-full bg-ink/25" />
      </div>
      {top}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">{children}</div>
      <div className="border-t border-sand-dark bg-white/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">{footer}</div>
    </aside>
  );
}
