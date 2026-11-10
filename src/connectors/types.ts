import type { Logger } from '@/lib/logger';
import type { Category, Status } from '@/lib/normalize';

export type RefreshMode = 'discovery' | 'live' | 'closing' | 'upcoming' | 'ended' | 'manual';

export interface RawAsset {
  externalId: string;
  title?: string | null;
  url?: string | null;
  region?: string | null;
  city?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  startPrice?: number | null;
  currentPrice?: number | null;
  deposit?: number | null;
  images?: string[];
}

/** What a connector returns for each auction. Leave unknown fields null/undefined — never invent values. */
export interface RawAuction {
  externalId: string;
  url: string;
  title: string;
  category: Category;
  status?: Status | null;
  startAt?: Date | null;
  endAt?: Date | null;
  region?: string | null;
  regions?: string[];
  city?: string | null;
  cities?: string[];
  district?: string | null;
  districts?: string[];
  locationText?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  assetCount?: number | null;
  startPrice?: number | null;
  currentPrice?: number | null;
  deposit?: number | null;
  images?: string[];
  organizer?: string | null;
  /** Cross-platform reference ids (e.g. an Infath reference) used by the dedup engine. */
  crossRefs?: string[];
  assets?: RawAsset[];
  /** Whitelisted raw fields for debugging. Never include personal data. */
  raw?: Record<string, unknown>;
}

export interface ConnectorContext {
  mode: RefreshMode;
  log: Logger;
  signal?: AbortSignal;
}

export interface Connector {
  id: string;
  name: string;
  baseUrl: string;
  method: 'api' | 'html' | 'browser';
  /** Modes the connector can serve with a narrower (cheaper) request. Others fall back to `discovery`. */
  modes: RefreshMode[];
  fetchAuctions(ctx: ConnectorContext): Promise<RawAuction[]>;
}

/** The source actively refuses automated access (bot challenge, geo-block, ...). Not retried. */
export class BlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedError';
  }
}
