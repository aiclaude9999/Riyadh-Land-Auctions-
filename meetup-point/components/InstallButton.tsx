'use client';

import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from './LocaleProvider';

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * "Install app": Android/desktop Chrome & Edge offer it through beforeinstallprompt; iPhones need
 * Share → Add to Home Screen, so there we show that hint instead. Hidden once installed.
 */
export default function InstallButton() {
  const t = useT();
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (standalone) return;
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const on = (e: Event) => {
      e.preventDefault();
      setEvt(e as PromptEvent);
    };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);

  if (!evt && !ios) return null;
  return (
    <span className="relative">
      <button
        type="button"
        onClick={async () => {
          if (evt) {
            await evt.prompt();
            setEvt(null);
          } else setShowHint((s) => !s);
        }}
        className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark"
      >
        <Download size={14} aria-hidden /> {t.installApp}
      </button>
      {showHint && <span className="absolute end-0 top-full z-50 mt-1 w-56 rounded-lg bg-ink p-2 text-xs text-white shadow-card">{t.iosInstall}</span>}
    </span>
  );
}
