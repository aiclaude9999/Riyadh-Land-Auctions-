/** Shapes shared by the group API and the browser. */
import type { LatLng } from './geo';
import type { TravelMode } from './people';
import type { RecommendResponse } from './recommendTypes';

export interface GroupPerson {
  id: string;
  name: string;
  mode: TravelMode;
  location: LatLng | null;
  districtId: string | null;
  access?: 'walk' | 'car';
}

export interface GroupView {
  id: string;
  version: number;
  createdAt: string;
  expiresAt: string;
  people: GroupPerson[];
  /** venue id → number of votes */
  votes: Record<string, number>;
  results: RecommendResponse | null;
  resultsAt: string | null;
  /** 'memory' = app not online yet: the link only works on this computer */
  storage?: 'upstash' | 'memory';
}

/** What the browser keeps (localStorage) for each group it created or joined. */
export interface GroupCreds {
  adminToken?: string;
  /** person id → edit token */
  people: Record<string, string>;
  /** random id used for this browser's vote */
  voter: string;
}

export const GROUP_TTL_DAYS = 7;
export const MAX_GROUP_PEOPLE = 6;
