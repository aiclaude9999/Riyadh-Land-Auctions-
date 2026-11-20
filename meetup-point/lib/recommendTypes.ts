/** Request/response shapes of POST /api/recommend (shared by server and browser). */
import type { LatLng } from './geo';
import type { ScoredVenue } from './scoring';
import type { VenueType } from './venues';

export interface RecommendRequest {
  people: { name: string; mode: 'car' | 'metro'; location: LatLng }[];
  venueType: VenueType;
  /** ISO time; omitted = leave now. */
  departAt?: string;
  /** Group preferences kept in the browser. */
  prefs?: import('./preferences').Preferences;
  filters?: Filters;
}

export interface Filters {
  /** only places ≤ 600 m from a metro station */
  nearMetro?: boolean;
  /** only places serving this food group */
  food?: import('./cuisine').CuisineGroup | null;
}

export interface VenueWarnings {
  /** the group arrives during a prayer pause window */
  prayer?: import('./timing').PrayerHit;
  /** people (index) whose metro trip falls outside metro hours */
  metroClosed?: number[];
}

export type ResultVenue = ScoredVenue & { warnings: VenueWarnings };

/** Grid of points with the longest trip from the group; the UI shades cells ≤ the chosen minutes. */
export interface Zone {
  cells: { lat: number; lng: number; maxEta: number }[];
  cellLat: number;
  cellLng: number;
}

export interface RecommendResponse {
  results: ResultVenue[];
  zone?: Zone;
  meta: {
    dataSource: 'free' | 'google';
    /** What produced the car times: Google live traffic, OSRM (no traffic) or a local estimate. */
    carSource: 'google-traffic' | 'osrm' | 'estimate' | 'none';
    metroSource: 'google-transit' | 'estimate' | 'none';
    center: LatLng;
    radiusM: number;
    /** departure used for the times (ISO) */
    leaveAt: string;
    /** car-time adjustment: Google live traffic, typical-traffic factor (free mode), or none */
    traffic: { kind: 'live' | 'typical' | 'none'; factor: number };
    candidates: number;
    notes: string[];
  };
}

export type RecommendError = { error: 'bad_request' | 'no_venues' | 'upstream'; message: string };
