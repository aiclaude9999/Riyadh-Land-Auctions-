/**
 * Notification engine. Rules (NotificationRule) decide WHAT to notify; channels decide WHERE.
 * In-app notifications are stored rows; Telegram is a pluggable channel (enabled via env + settings).
 */
import { prisma } from './db';
import { logger } from './logger';
import { CATEGORY_LABELS, type Category } from './normalize';
import { formatRiyadh } from './time';
import { getSettings } from './settings';
import type { AuctionEvent } from './ingest';

export type RuleType = 'new_riyadh' | 'new_category' | 'ending_saved' | 'date_changed' | 'price_changed';

export const RULE_LABELS: Record<RuleType, string> = {
  new_riyadh: 'ظهور مزاد جديد في الرياض',
  new_category: 'ظهور مزاد جديد من نوع محدد',
  ending_saved: 'اقتراب انتهاء مزاد محفوظ',
  date_changed: 'تغيير موعد مزاد',
  price_changed: 'تغيير السعر المعروض',
};

export const DEFAULT_RULES: { type: RuleType; enabled: boolean; params: Record<string, unknown> }[] = [
  { type: 'new_riyadh', enabled: true, params: { scope: 'riyadh_city' } },
  { type: 'new_category', enabled: false, params: { categories: ['real_estate'], scope: 'riyadh_city' } },
  { type: 'ending_saved', enabled: true, params: { minutes: 60 } },
  { type: 'date_changed', enabled: true, params: { savedOnly: true } },
  { type: 'price_changed', enabled: true, params: { savedOnly: true } },
];

export async function ensureDefaultRules() {
  for (const r of DEFAULT_RULES) {
    const exists = await prisma.notificationRule.findFirst({ where: { type: r.type } });
    if (!exists) await prisma.notificationRule.create({ data: { type: r.type, enabled: r.enabled, params: r.params as any } });
  }
}

// ---- channels ---------------------------------------------------------------
export interface OutgoingNotification { title: string; body: string; url?: string }
export interface Channel { id: string; send(n: OutgoingNotification): Promise<void> }

const telegram: Channel = {
  id: 'telegram',
  async send(n) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const s = await getSettings();
    const chatId = s.telegram.chatId || process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId || !s.telegram.enabled) return; // not configured → silently skip
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `${n.title}\n${n.body}${n.url ? `\n${n.url}` : ''}`, disable_web_page_preview: true }),
    });
    if (!res.ok) throw new Error(`telegram ${res.status}`);
  },
};
const CHANNELS: Record<string, Channel> = { telegram };

async function emit(type: RuleType, auctionId: string | null, dedupeKey: string, n: OutgoingNotification, channels: string[]) {
  try {
    await prisma.notification.create({ data: { type, auctionId, title: n.title, body: n.body, dedupeKey, channels, delivered: ['in_app'] } });
  } catch (e: any) {
    if (e?.code === 'P2002') return; // already notified
    throw e;
  }
  for (const ch of channels.filter((c) => c !== 'in_app')) {
    try {
      await CHANNELS[ch]?.send(n);
      await prisma.notification.update({ where: { dedupeKey }, data: { delivered: { push: ch } } });
    } catch (e) {
      logger.warn({ err: String(e), ch }, 'notification channel failed');
    }
  }
}

const inScope = (a: { hasRiyadhCity: boolean; hasRiyadhRegion: boolean }, scope?: unknown) =>
  scope === 'all' ? true : scope === 'riyadh_region' ? a.hasRiyadhRegion : a.hasRiyadhCity;

/** Evaluate ingest events against enabled rules. `suppressNew` avoids a flood on a source's first sync. */
export async function processEvents(events: AuctionEvent[], opts: { suppressNew?: boolean } = {}) {
  if (!events.length) return 0;
  const rules = await prisma.notificationRule.findMany({ where: { enabled: true } });
  if (!rules.length) return 0;
  const ids = [...new Set(events.map((e) => e.auctionId))];
  const auctions = new Map((await prisma.auction.findMany({ where: { id: { in: ids } }, include: { saved: true, listings: { select: { url: true }, take: 1 } } })).map((a) => [a.id, a]));
  let n = 0;
  for (const e of events) {
    const a = auctions.get(e.auctionId);
    if (!a) continue;
    const url = a.listings[0]?.url;
    for (const r of rules) {
      const p = (r.params ?? {}) as Record<string, any>;
      if (e.kind === 'created' && !opts.suppressNew && a.status !== 'ended') {
        if (r.type === 'new_riyadh' && inScope(a, p.scope ?? 'riyadh_city')) {
          await emit('new_riyadh', a.id, `new_riyadh:${a.id}`, { title: 'مزاد جديد في الرياض', body: `${a.title} — ${CATEGORY_LABELS[a.category as Category] ?? ''}`, url }, r.channels); n++;
        }
        if (r.type === 'new_category' && (p.categories ?? []).includes(a.category) && inScope(a, p.scope ?? 'all')) {
          await emit('new_category', a.id, `new_category:${r.id}:${a.id}`, { title: `مزاد ${CATEGORY_LABELS[a.category as Category]} جديد`, body: a.title, url }, r.channels); n++;
        }
      }
      if (e.kind === 'changed' && (!p.savedOnly || a.saved)) {
        if (r.type === 'date_changed' && (e.field === 'endAt' || e.field === 'startAt')) {
          const label = e.field === 'endAt' ? 'موعد الإغلاق' : 'موعد البدء';
          await emit('date_changed', a.id, `date:${a.id}:${e.field}:${e.newValue}`, { title: `تغيّر ${label}`, body: `${a.title}: ${formatRiyadh(e.oldValue)} ← ${formatRiyadh(e.newValue)}`, url }, r.channels); n++;
        }
        if (r.type === 'price_changed' && e.field === 'currentPrice') {
          await emit('price_changed', a.id, `price:${a.id}:${e.newValue}`, { title: 'تغيّر السعر المعروض', body: `${a.title}: ${e.oldValue ?? '—'} ← ${e.newValue} ر.س`, url }, r.channels); n++;
        }
      }
    }
  }
  return n;
}

/** Saved auctions closing within the configured window. Run every minute by the worker. */
export async function checkEndingSoon(now = new Date()) {
  const rules = await prisma.notificationRule.findMany({ where: { enabled: true, type: 'ending_saved' } });
  let n = 0;
  for (const r of rules) {
    const minutes = Number((r.params as any)?.minutes ?? 60);
    const soon = await prisma.auction.findMany({
      where: { saved: { isNot: null }, status: { not: 'ended' }, endAt: { gt: now, lte: new Date(now.getTime() + minutes * 60_000) } },
      include: { listings: { select: { url: true }, take: 1 } },
    });
    for (const a of soon) {
      const left = Math.max(1, Math.round((a.endAt!.getTime() - now.getTime()) / 60_000));
      await emit('ending_saved', a.id, `ending:${a.id}:${a.endAt!.toISOString()}`, { title: 'مزاد محفوظ يقترب من الإغلاق', body: `${a.title} — يتبقى ${left} دقيقة`, url: a.listings[0]?.url }, r.channels);
      n++;
    }
  }
  return n;
}
