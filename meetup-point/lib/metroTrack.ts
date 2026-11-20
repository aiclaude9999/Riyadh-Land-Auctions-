/**
 * Follow the real metro track between two stations (instead of a straight line).
 * Each line's OSM geometry is a set of pieces; we join them into a graph (shared points, plus pieces
 * whose ends are within 60 m) and take the shortest way between the points nearest the two stations.
 */
import { haversineMeters, type LatLng } from './geo';

export interface LineFeature {
  geometry: { coordinates: [number, number][][] }; // [lng, lat]
  properties: { ref: string };
}

interface TrackGraph {
  pts: LatLng[];
  adj: { to: number; m: number }[][];
}

const JOIN_M = 60;

export function buildTrack(line: LineFeature): TrackGraph {
  const pts: LatLng[] = [];
  const index = new Map<string, number>();
  const adj: { to: number; m: number }[][] = [];
  const node = (lng: number, lat: number) => {
    const k = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    let i = index.get(k);
    if (i === undefined) {
      i = pts.push({ lat, lng }) - 1;
      index.set(k, i);
      adj.push([]);
    }
    return i;
  };
  const link = (a: number, b: number) => {
    if (a === b) return;
    const m = haversineMeters(pts[a], pts[b]);
    adj[a].push({ to: b, m });
    adj[b].push({ to: a, m });
  };
  const ends: number[] = [];
  for (const piece of line.geometry.coordinates) {
    let prev = -1;
    piece.forEach(([lng, lat], k) => {
      const i = node(lng, lat);
      if (prev >= 0) link(prev, i);
      prev = i;
      if (k === 0 || k === piece.length - 1) ends.push(i);
    });
  }
  // bridge small gaps between pieces
  for (let x = 0; x < ends.length; x++)
    for (let y = x + 1; y < ends.length; y++) if (haversineMeters(pts[ends[x]], pts[ends[y]]) <= JOIN_M) link(ends[x], ends[y]);
  return { pts, adj };
}

function nearest(g: TrackGraph, p: LatLng): number {
  let best = 0;
  let bestM = Infinity;
  g.pts.forEach((q, i) => {
    const m = haversineMeters(p, q);
    if (m < bestM) {
      bestM = m;
      best = i;
    }
  });
  return best;
}

/** Track points from station `a` to station `b`; null when the track pieces do not connect. */
export function trackBetween(g: TrackGraph, a: LatLng, b: LatLng): LatLng[] | null {
  if (!g.pts.length) return null;
  const s = nearest(g, a);
  const t = nearest(g, b);
  const dist = new Array<number>(g.pts.length).fill(Infinity);
  const prev = new Array<number>(g.pts.length).fill(-1);
  const done = new Array<boolean>(g.pts.length).fill(false);
  dist[s] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < dist.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === t) break;
    done[u] = true;
    for (const e of g.adj[u])
      if (dist[u] + e.m < dist[e.to]) {
        dist[e.to] = dist[u] + e.m;
        prev[e.to] = u;
      }
  }
  if (dist[t] === Infinity) return null;
  const path: LatLng[] = [];
  for (let v = t; v >= 0; v = prev[v]) path.unshift(g.pts[v]);
  return [a, ...path, b];
}

/** Ride path along the track, station by station; falls back to straight lines where pieces are missing. */
export function ridePath(g: TrackGraph | undefined, stations: LatLng[]): LatLng[] {
  if (!g || stations.length < 2) return stations;
  const out: LatLng[] = [];
  for (let i = 1; i < stations.length; i++) {
    const seg = trackBetween(g, stations[i - 1], stations[i]);
    const ok = seg && pathLength(seg) < haversineMeters(stations[i - 1], stations[i]) * 3; // reject silly detours
    out.push(...(ok ? seg! : [stations[i - 1], stations[i]]));
  }
  return out;
}

export function pathLength(p: LatLng[]): number {
  let m = 0;
  for (let i = 1; i < p.length; i++) m += haversineMeters(p[i - 1], p[i]);
  return m;
}
