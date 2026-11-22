'use client';
import { useState } from 'react';

/**
 * A card's picture. With no picture, or one that fails to load, the plot itself is the picture:
 * its area at display size and what it is — same frame size, so card rows stay even.
 */
export function Cover({ src, ratio, figure, caption, children }: { src?: string | null; ratio: string; figure?: string | null; caption?: string | null; children?: React.ReactNode }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-[var(--sunk)] ${ratio}`}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <div className="absolute inset-x-0 bottom-0 flex flex-col px-3 pb-3">
          {figure && <span className="num text-[28px] font-bold leading-none tracking-tight">{figure}</span>}
          {caption && <span className="muted mt-1.5 text-xs font-semibold">{caption}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
