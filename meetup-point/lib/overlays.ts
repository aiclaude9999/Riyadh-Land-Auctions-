import type { LatLng } from './geo';

/** Map drawings shared by the Google and the free map: route lines and the chosen neighbourhood. */
export type Overlay =
  | { kind: 'line'; points: LatLng[]; color: string; weight: number; dashed?: boolean; opacity?: number }
  | { kind: 'area'; rings: [number, number][][]; color: string };
