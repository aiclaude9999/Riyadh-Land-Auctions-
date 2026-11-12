/**
 * Ingest pipeline: connector output → Listing rows → deduplicated canonical Auction rows.
 * Never deletes data: auctions that disappear from a source are kept as they were.
 */
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { classifyGeo, type GeoScope } from './geo';
import { mapPropertyType, mapUsage, normalizeOrganizer, normalizeTitle, statusFromDates, uniq, type Status } from './normalize';
import { findBestMatch, type DedupRecord } from './dedup';
import type { RawAuction } from '@/connectors/types';

export type AuctionEvent =
  | { kind: 'created'; auctionId: string }
  | { kind: 'changed'; auctionId: string; field: 'startAt' | 'endAt' | 'currentPrice' | 'status'; oldValue: string | null; newValue: string | null };

const DAY = 86_400_000;
const dec = (n?: number | null) => (n == null ? null : new Prisma.Decimal(n));

/** Pure: convert a connector record to listing fields (normalisation + geo + status). */
export function toListingData(r: RawAuction, now = new Date()) {
  const cities = uniq<string>([...(r.cities ?? []), r.city, ...(r.assets ?? []).map((a) => a.city)]);
  const regions = uniq<string>([...(r.regions ?? []), r.region, ...(r.assets ?? []).map((a) => a.region)]);
  const districts = uniq<string>([...(r.districts ?? []), r.district, ...(r.assets ?? []).map((a) => a.district)]);
  const geo = classifyGeo({ cities, regions, districts, lat: r.latitude, lng: r.longitude });
  const dateStatus = statusFromDates(r.startAt ?? null, r.endAt ?? null, now);
  // Source status wins; fall back to dates. A "live" listing whose end passed >6h ago is treated as ended.
  let status: Status = r.status ?? dateStatus ?? 'upcoming';
  if (status === 'live' && r.endAt && now.getTime() - r.endAt.getTime() > 6 * 3_600_000) status = 'ended';
  return {
    title: r.title,
    normalizedTitle: normalizeTitle(r.title),
    category: r.category,
    status,
    startAt: r.startAt ?? null,
    endAt: r.endAt ?? null,
    region: r.region ?? regions[0] ?? null,
    city: r.city ?? cities[0] ?? null,
    district: r.district ?? districts[0] ?? null,
    locationText: r.locationText ?? null,
    cities,
    assetCount: r.assetCount ?? null,
    startPrice: r.startPrice ?? null,
    currentPrice: r.currentPrice ?? null,
    deposit: r.deposit ?? null,
    images: uniq<string>(r.images ?? []).slice(0, 12),
    organizer: r.organizer ?? null,
    normalizedOrganizer: r.organizer ? normalizeOrganizer(r.organizer) : null,
    crossRefs: r.crossRefs ?? [],
    geo,
    regions,
    districts,
  };
}

type ListingData = ReturnType<typeof toListingData>;

export interface IngestResult { found: number; created: number; updated: number; events: AuctionEvent[] }

export async function ingest(sourceId: string, raws: RawAuction[], now = new Date()): Promise<IngestResult> {
  const res: IngestResult = { found: raws.length, created: 0, updated: 0, events: [] };
  const seen = new Set<string>();
  // auctions that ended more than 120 days ago are not kept (see the cleanup in scripts/collect.ts)
  const tooOld = (r: RawAuction) => r.status === 'ended' && !!r.endAt && now.getTime() - r.endAt.getTime() > 120 * DAY;
  const unique = raws.filter((r) => r.externalId && !tooOld(r) && !seen.has(r.externalId) && seen.add(r.externalId));
  // Listings of ONE source never merge with each other, so they can be processed in parallel.
  // This matters when the database is far away (each query is a network round trip).
  await mapLimit(unique, CONCURRENCY, async (r) => {
    const d = toListingData(r, now);
    const listingFields = {
      url: r.url, title: d.title, normalizedTitle: d.normalizedTitle, category: d.category, status: d.status,
      startAt: d.startAt, endAt: d.endAt, region: d.region, city: d.city, district: d.district, locationText: d.locationText,
      cities: d.cities, assetCount: d.assetCount, startPrice: dec(d.startPrice), currentPrice: dec(d.currentPrice), deposit: dec(d.deposit),
      images: d.images, organizer: d.organizer, normalizedOrganizer: d.normalizedOrganizer, crossRefs: d.crossRefs,
      raw: (r.raw ?? undefined) as Prisma.InputJsonValue | undefined, lastSuccessAt: now,
    };

    const existing = await prisma.listing.findUnique({ where: { sourceId_externalId: { sourceId, externalId: r.externalId } }, select: { id: true, auctionId: true } });
    let auctionId: string;
    let listingId: string;
    if (existing) {
      await prisma.listing.update({ where: { id: existing.id }, data: listingFields });
      auctionId = existing.auctionId;
      listingId = existing.id;
      res.updated++;
    } else {
      const match = await findDuplicate(sourceId, d);
      if (match) {
        auctionId = match;
      } else {
        const a = await prisma.auction.create({ data: { ...auctionFieldsFrom([d]), firstSeenAt: now, lastSuccessAt: now } });
        auctionId = a.id;
        res.events.push({ kind: 'created', auctionId });
      }
      const l = await prisma.listing.create({ data: { ...listingFields, sourceId, externalId: r.externalId, auctionId, firstSeenAt: now } });
      listingId = l.id;
      res.created++;
    }

    await mapLimit(r.assets ?? [], 8, async (a) => {
      const ag = classifyGeo({ cities: [a.city], regions: [a.region], districts: [a.district], lat: a.latitude, lng: a.longitude });
      const fields = {
        title: a.title ?? null, url: a.url ?? null, region: a.region ?? null, city: a.city ?? null, district: a.district ?? null, geoScope: ag.scope,
        latitude: a.latitude ?? null, longitude: a.longitude ?? null, startPrice: dec(a.startPrice), currentPrice: dec(a.currentPrice), deposit: dec(a.deposit), images: a.images ?? [],
        propertyType: a.propertyType ?? null, usage: a.usage ?? null, areaSqm: a.areaSqm ?? null, status: a.status ?? null,
        description: a.description?.slice(0, 2000) ?? null, notes: a.notes?.slice(0, 2000) ?? null,
        streetSides: a.streetSides ?? null, streetWidth: a.streetWidth ?? null, corner: a.corner ?? null,
      };
      await prisma.asset.upsert({ where: { listingId_externalId: { listingId, externalId: a.externalId } }, create: { listingId, externalId: a.externalId, ...fields }, update: fields });
    });

    res.events.push(...(await recomputeAuction(auctionId, now)));
  });
  return res;
}

const CONCURRENCY = Math.max(1, Number(process.env.INGEST_CONCURRENCY ?? 8));

/** Run `fn` over `items` with at most `limit` running at once. */
export async function mapLimit<T>(items: T[], limit: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

/** Find an existing canonical auction (from another source) that this listing duplicates. */
async function findDuplicate(sourceId: string, d: ListingData): Promise<string | null> {
  const anchor = d.endAt ?? d.startAt;
  if (!anchor && !d.crossRefs.length) return null;
  const or: Prisma.AuctionWhereInput[] = [];
  if (d.crossRefs.length) or.push({ listings: { some: { crossRefs: { hasSome: d.crossRefs } } } });
  if (anchor) {
    const win = { gte: new Date(anchor.getTime() - 2 * DAY), lte: new Date(anchor.getTime() + 2 * DAY) };
    or.push({ endAt: win }, { startAt: win });
  }
  const candidates = await prisma.auction.findMany({
    where: { OR: or },
    select: { id: true, normalizedTitle: true, normalizedOrganizer: true, category: true, startAt: true, endAt: true, cities: true, assetCount: true, listings: { select: { sourceId: true, crossRefs: true } } },
    take: 300,
  });
  const recs: (DedupRecord & { id: string })[] = candidates.map((c) => ({
    id: c.id, sourceIds: c.listings.map((l) => l.sourceId), normalizedTitle: c.normalizedTitle, normalizedOrganizer: c.normalizedOrganizer,
    category: c.category, startAt: c.startAt, endAt: c.endAt, cities: c.cities, assetCount: c.assetCount, crossRefs: c.listings.flatMap((l) => l.crossRefs),
  }));
  const best = findBestMatch(
    { sourceIds: [sourceId], normalizedTitle: d.normalizedTitle, normalizedOrganizer: d.normalizedOrganizer, category: d.category, startAt: d.startAt, endAt: d.endAt, cities: d.cities, assetCount: d.assetCount, crossRefs: d.crossRefs },
    recs,
  );
  return best?.id ?? null;
}

interface MergeInput {
  title: string; normalizedTitle: string; category: string; status: string; startAt: Date | null; endAt: Date | null;
  region: string | null; city: string | null; district: string | null; locationText: string | null; cities: string[];
  regions?: string[]; districts?: string[]; assetCount: number | null; startPrice: number | null; currentPrice: number | null; deposit: number | null;
  images: string[]; organizer: string | null; normalizedOrganizer: string | null; assetCities?: string[]; geoScopes?: GeoScope[];
  assetInfo?: AssetInfo[];
}

export interface AssetInfo { propertyType: string | null; usage: string | null; areaSqm: number | null; startPrice: number | null; deposit: number | null }

/** Pure: land / property summary for an auction from its assets, falling back to the title when assets are unknown. */
export function propertySummary(category: string, title: string, assets: AssetInfo[]) {
  const known = assets.filter((a) => a.propertyType);
  let propertyTypes = uniq<string>(known.map((a) => a.propertyType));
  const usages = uniq<string>(assets.map((a) => a.usage));
  const lands = known.filter((a) => a.propertyType === 'land');
  let landCount: number | null = known.length ? lands.length : null;
  const areas = lands.map((a) => a.areaSqm).filter((x): x is number => x != null);
  if (!known.length && category === 'real_estate') {
    const t = mapPropertyType(title);
    if (t) propertyTypes = [t];
    const u = mapUsage(title);
    if (u && !usages.includes(u)) usages.push(u);
    landCount = null; // unknown count
  }
  const prices = assets.map((a) => a.startPrice).filter((x): x is number => x != null);
  const deposits = assets.map((a) => a.deposit).filter((x): x is number => x != null);
  return {
    hasLand: propertyTypes.includes('land'),
    landCount,
    landAreaSqm: areas.length ? Math.round(areas.reduce((a, b) => a + b, 0) * 100) / 100 : null,
    propertyTypes,
    usages,
    minAssetPrice: prices.length ? Math.min(...prices) : null,
    minAssetDeposit: deposits.length ? Math.min(...deposits) : null,
  };
}

/** Pure: merge listings (most recent first) into canonical auction fields. */
export function auctionFieldsFrom(ls: MergeInput[]) {
  const first = <K extends keyof MergeInput>(k: K) => ls.find((l) => l[k] != null && l[k] !== '')?.[k] ?? null;
  const cities = uniq<string>(ls.flatMap((l) => [...l.cities, ...(l.assetCities ?? [])]));
  const regions = uniq<string>(ls.flatMap((l) => [l.region, ...(l.regions ?? [])]));
  const districts = uniq<string>(ls.flatMap((l) => [l.district, ...(l.districts ?? [])]));
  const geo = classifyGeo({ cities, regions, districts });
  const scopes = ls.flatMap((l) => l.geoScopes ?? []);
  const hasRiyadhCity = geo.hasRiyadhCity || scopes.includes('riyadh_city');
  const hasRiyadhRegion = geo.hasRiyadhRegion || hasRiyadhCity || scopes.includes('riyadh_region');
  const scope: GeoScope = hasRiyadhCity ? 'riyadh_city' : hasRiyadhRegion ? 'riyadh_region' : geo.scope;
  const props = propertySummary(first('category') as string, first('title') as string, ls.flatMap((l) => l.assetInfo ?? []));
  const statuses = ls.map((l) => l.status);
  const status = statuses.includes('live') ? 'live' : (first('status') as string) ?? 'upcoming';
  return {
    title: first('title') as string,
    normalizedTitle: first('normalizedTitle') as string,
    category: first('category') as string,
    status,
    startAt: first('startAt') as Date | null,
    endAt: first('endAt') as Date | null,
    region: first('region') as string | null,
    city: first('city') as string | null,
    district: first('district') as string | null,
    locationText: first('locationText') as string | null,
    cities,
    geoScope: scope,
    hasRiyadhCity,
    hasRiyadhRegion,
    isMultiLocation: geo.isMultiLocation,
    assetCount: first('assetCount') as number | null,
    // auction-level price/deposit when the source gives one, else the lowest among its assets ("يبدأ من")
    startPrice: dec((first('startPrice') as number | null) ?? props.minAssetPrice),
    currentPrice: dec(first('currentPrice') as number | null),
    deposit: dec((first('deposit') as number | null) ?? props.minAssetDeposit),
    hasLand: props.hasLand,
    landCount: props.landCount,
    landAreaSqm: props.landAreaSqm,
    propertyTypes: props.propertyTypes,
    usages: props.usages,
    images: uniq<string>(ls.flatMap((l) => l.images)).slice(0, 12),
    organizer: first('organizer') as string | null,
    normalizedOrganizer: first('normalizedOrganizer') as string | null,
  };
}

const numOrNull = (d: Prisma.Decimal | null) => (d == null ? null : Number(d));
const iso = (d: Date | null) => (d ? d.toISOString() : null);

async function recomputeAuction(auctionId: string, now: Date): Promise<AuctionEvent[]> {
  const before = await prisma.auction.findUnique({ where: { id: auctionId } });
  const listings = await prisma.listing.findMany({ where: { auctionId }, orderBy: { lastSuccessAt: 'desc' }, include: { assets: { select: { city: true, geoScope: true, propertyType: true, usage: true, areaSqm: true, startPrice: true, deposit: true } } } });
  if (!before || !listings.length) return [];
  const merged = auctionFieldsFrom(listings.map((l) => ({
    ...l, startPrice: numOrNull(l.startPrice), currentPrice: numOrNull(l.currentPrice), deposit: numOrNull(l.deposit),
    assetCities: uniq<string>(l.assets.map((a) => a.city)), geoScopes: l.assets.map((a) => a.geoScope as GeoScope),
    assetInfo: l.assets.map((a) => ({ propertyType: a.propertyType, usage: a.usage, areaSqm: a.areaSqm, startPrice: numOrNull(a.startPrice), deposit: numOrNull(a.deposit) })),
  })));
  const events: AuctionEvent[] = [];
  const diffs: [AuctionEvent & { kind: 'changed' }][] = [];
  const cmp: [('startAt' | 'endAt' | 'currentPrice' | 'status'), string | null, string | null][] = [
    ['startAt', iso(before.startAt), iso(merged.startAt)],
    ['endAt', iso(before.endAt), iso(merged.endAt)],
    ['currentPrice', before.currentPrice?.toString() ?? null, merged.currentPrice?.toString() ?? null],
    ['status', before.status, merged.status],
  ];
  for (const [field, o, n] of cmp) {
    if (o !== n && n != null) diffs.push([{ kind: 'changed', auctionId, field, oldValue: o, newValue: n }]);
  }
  await prisma.auction.update({ where: { id: auctionId }, data: { ...merged, lastSuccessAt: now } });
  if (diffs.length) {
    await prisma.auctionChange.createMany({ data: diffs.map(([e]) => ({ auctionId, field: e.field, oldValue: e.oldValue, newValue: e.newValue, at: now })) });
    // Only report changes to an already-known value (filling a previously empty field is not a "change").
    events.push(...diffs.map(([e]) => e).filter((e) => e.oldValue != null));
  }
  return events;
}

/** Periodic sweep: auctions whose end time passed long ago but no source confirmed the end. */
export async function sweepEnded(now = new Date()) {
  const cutoff = new Date(now.getTime() - 2 * 3_600_000);
  const r1 = await prisma.auction.updateMany({ where: { status: { not: 'ended' }, endAt: { lt: cutoff } }, data: { status: 'ended' } });
  const r2 = await prisma.auction.updateMany({ where: { status: 'upcoming', startAt: { lte: now }, OR: [{ endAt: null }, { endAt: { gt: now } }] }, data: { status: 'live' } });
  return { ended: r1.count, started: r2.count };
}
