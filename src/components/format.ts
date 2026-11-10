import { CATEGORY_LABELS, STATUS_LABELS, type Category, type Status } from '@/lib/normalize';
export { formatRiyadh } from '@/lib/time';

export const catLabel = (c: string) => CATEGORY_LABELS[c as Category] ?? c;
export const statusLabel = (s: string) => STATUS_LABELS[s as Status] ?? s;

export const STATUS_STYLE: Record<string, string> = {
  live: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  upcoming: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
  ended: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

export const CAT_ICON: Record<string, string> = { real_estate: '🏠', vehicle: '🚗', equipment: '🏗️', scrap: '♻️', collectible: '💎', other: '📦' };

const money = new Intl.NumberFormat('ar-SA-u-nu-latn', { maximumFractionDigits: 0 });
export const fmtMoney = (n?: number | null) => (n == null ? null : `${money.format(n)} ر.س`);

export function timeAgo(d?: string | null): string {
  if (!d) return 'لم يتم بعد';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'الآن';
  if (s < 3600) return `قبل ${Math.round(s / 60)} د`;
  if (s < 86400) return `قبل ${Math.round(s / 3600)} س`;
  return `قبل ${Math.round(s / 86400)} يوم`;
}

export const SOURCE_STATUS: Record<string, { label: string; cls: string }> = {
  ok: { label: 'يعمل', cls: 'bg-emerald-500' },
  running: { label: 'جاري التحديث', cls: 'bg-sky-500 animate-pulse' },
  error: { label: 'خطأ', cls: 'bg-red-500' },
  blocked: { label: 'محجوب', cls: 'bg-amber-500' },
  idle: { label: 'لم يبدأ', cls: 'bg-zinc-400' },
};
