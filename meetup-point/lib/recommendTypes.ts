/** Request/response shapes of POST /api/recommend (shared by server and browser). */
import type { LatLng } from './geo';
import type { ScoredVenue } from './scoring';
import type { VenueType } from './venues';

export interface RecommendRequest {
  people: { name: string; mode: 'car' | 'metro'; location: LatLng }[];
  venueType: VenueType;
  /** ISO time; omitted = leave now. */
  departAt?: string;
}

export interface RecommendResponse {
  results: ScoredVenue[];
  meta: {
    dataSource: 'free' | 'google';
    /** What produced the car times: Google live traffic, OSRM (no traffic) or a local estimate. */
    carSource: 'google-traffic' | 'osrm' | 'estimate' | 'none';
    metroSource: 'google-transit' | 'estimate' | 'none';
    center: LatLng;
    radiusM: number;
    candidates: number;
    notes: string[];
  };
}

export type RecommendError = { error: 'bad_request' | 'no_venues' | 'upstream'; message: string };
