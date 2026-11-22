'use client';

import { useState } from 'react';
import { useLocale, useT } from './LocaleProvider';
import type { GroupApi } from '@/lib/useGroup';

/** "Plan together": create a shared link, or show the current group's link with Copy / WhatsApp. */
export default function SharePanel({ group, canShare }: { group: GroupApi; canShare: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!group.id) {
    return (
      <div className="mx-4 mt-1 rounded-2xl border border-brand/20 bg-white p-3 text-sm shadow-card">
        <p className="font-semibold text-brand-dark">{t.shareTitle}</p>
        <p className="mt-0.5 text-xs text-slate-600">{t.shareIntro}</p>
        <button
          type="button"
          disabled={!canShare || group.busy}
          onClick={() => group.start().catch(() => setFailed(true))}
          className="mt-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:bg-slate-300"
        >
          📤 {group.busy ? t.sharing : t.shareButton}
        </button>
        {failed && <p className="mt-1 text-xs text-rose-600">{t.requestFailed}</p>}
      </div>
    );
  }

  if (group.error === 'missing') {
    return (
      <div className="mx-4 mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        {t.groupMissing}{' '}
        <button type="button" className="underline" onClick={group.leave}>
          {t.leaveGroup}
        </button>
      </div>
    );
  }

  const link = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?g=${group.id}` : '';
  const role = group.isAdmin ? t.organiser : Object.keys(group.creds?.people ?? {}).length ? t.member : t.visitor;
  const expires = group.view ? new Date(group.view.expiresAt).toLocaleDateString(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long' }) : '';

  return (
    <div className="mx-4 mt-1 space-y-2 rounded-2xl border border-brand/20 bg-white p-3 text-sm shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-brand-dark">{role}</p>
        <button type="button" onClick={group.leave} className="text-xs text-slate-500 hover:underline">
          {t.leaveGroup}
        </button>
      </div>
      <div className="flex gap-1.5">
        <input readOnly value={link} dir="ltr" aria-label={t.shareLink} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs" />
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(link).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs hover:border-brand"
        >
          {copied ? t.copied : t.copy}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(t.whatsappText(link))}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-md bg-[#25D366] px-2 py-1 text-xs font-medium text-white hover:brightness-95"
        >
          {t.whatsapp}
        </a>
      </div>
      {group.view?.storage === 'memory' && <p className="text-xs text-amber-700">{t.localOnlyNote}</p>}
      {group.error === 'sync' && <p className="text-xs text-amber-700">{t.syncError}</p>}
      <p className="text-xs text-slate-500">
        {t.groupExpires(expires)} {t.privacyNote}
      </p>
    </div>
  );
}
