import type { LatLng } from './geo';

/** Map drawings shared by the Google and the free map: route lines and the chosen neighbourhood. */
export type Overlay =
  | { kind: 'line'; points: LatLng[]; color: string; weight: number; dashed?: boolean; opacity?: number; outline?: boolean }
  | { kind: 'dot'; at: LatLng; color: string; label?: string }
  | { kind: 'area'; rings: [number, number][][]; color: string }
  | { kind: 'cell'; south: number; west: number; north: number; east: number; color: string; opacity: number };

/** What the map should zoom to: one point (close-up) or several (fit them all). `key` changes → zoom again. */
export interface FitTarget {
  points: LatLng[];
  key: string;
}
