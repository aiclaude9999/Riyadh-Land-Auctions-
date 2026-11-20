/** Request/response shapes of POST /api/recommend (shared by server and browser). */
import type { LatLng } from './geo';
import type { ScoredVenue } from './scoring';
import type { VenueType } from './venues';

export interface RecommendRequest {
  people: { name: string; mode: 'car' | 'metro'; location: LatLng; access?: 'walk' | 'car'; likes?: import('./cuisine').CuisineGroup[]; avoids?: import('./cuisine').CuisineGroup[] }[];
  venueType: VenueType;
  /** ISO time; omitted = leave now. */
  departAt?: string;
  /** Group preferences kept in the browser. */
  prefs?: import('./preferences').Preferences;
  filters?: Filters;
  /** "Use as meeting place": score exactly these places (from the map layer) instead of searching */
  venueIds?: string[];
  /** fairness over time: >1 for people who travelled more last times (their minutes count more) */
  weights?: number[];
  /** walking multiplier for metro users (heat); default: from the weather at that time */
  heatFactor?: number;
  /** Ramadan mode: Ramadan traffic pattern, metro hours and iftar warnings */
  ramadan?: boolean;
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
  /** people (index) who would walk > 20 min to the first station: suggest car/taxi */
  longWalk?: number[];
  /** Ramadan: arriving in the hour around iftar */
  iftar?: boolean;
}

export type ResultVenue = ScoredVenue & { warnings: VenueWarnings; match: import('./matching').Match; openAtArrival?: boolean | null };

/** Grid of points with the longest trip from the group; the UI shades cells ≤ the chosen minutes. */
export interface Zone {
  /** per = each person's minutes to that point (for the "everyone's reach" map) */
  cells: { lat: number; lng: number; maxEta: number; per?: number[] }[];
  cellLat: number;
  cellLng: number;
}

export interface RecommendResponse {
  /** places of all three rankings (fair ones first, in order) */
  results: ResultVenue[];
  /** venue ids per ranking style: fairest / quickest overall / best match */
  styles?: Record<import('./matching').Style, string[]>;
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
    /** average metro wait used (depends on the time of day) */
    metroWaitMin?: number;
    /** learned correction factors from real trip reports */
    calibration?: { car: number; metro: number };
    /** temperature used for heat-aware walking */
    heat?: import('./weather').Heat;
    ramadan?: boolean;
    /** a departure time that would make the fairest place's longest trip clearly shorter */
    betterTime?: { departAt: string; maxEta: number; saves: number };
    /** longest trip of the fairest place for other departure times (for the "best time" strip) */
    timeOptions?: { departAt: string; maxEta: number; blocked?: 'metro' | 'prayer' }[];
    candidates: number;
    notes: string[];
  };
}

export type RecommendError = { error: 'bad_request' | 'no_venues' | 'upstream'; message: string };
