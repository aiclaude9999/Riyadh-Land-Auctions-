/**
 * Local travel-time estimates, used when no routing API answers (spec "Fallback").
 * All results are flagged `estimated` in the UI.
 *
 * Metro: walk to a station (5 km/h) + 4 min wait + 1.5 min per station + 5 min per transfer
 *        + walk from the last station. The best station pair is searched over the network
 *        (Dijkstra on station×line nodes), trying the 3 stations nearest each end.
 *        If walking the whole way is quicker, the person simply walks.
 * Car:   straight line × detour factor at an average city speed + parking time.
 */
import { haversineMeters, type LatLng } from './geo';
import { nearestStations, type Station } from './metro';

export interface MetroParams {
  walkKmh: number;
  /** Streets are not straight lines: walking distance ≈ straight line × this. */
  walkDetour: number;
  waitMin: number;
  minPerStation: number;
  transferMin: number;
  /** How many stations near each end to try. */
  stationsToTry: number;
}

export const DEFAULT_METRO: MetroParams = { walkKmh: 5, walkDetour: 1.25, waitMin: 4, minPerStation: 1.5, transferMin: 5, stationsToTry: 3 };

export interface MetroEstimate {
  minutes: number;
  walkMinutes: number;
  walkOnly: boolean;
  fromStation?: string;
  toStation?: string;
  stations: number;
  transfers: number;
}

export function walkMinutes(a: LatLng, b: LatLng, p: Pick<MetroParams, 'walkKmh' | 'walkDetour'> = DEFAULT_METRO): number {
  return ((haversineMeters(a, b) * p.walkDetour) / 1000 / p.walkKmh) * 60;
}

interface Node {
  station: Station;
  line: string;
}

interface Edge {
  to: number;
  min: number;
  stations: number;
  transfers: number;
}

interface Graph {
  nodes: Node[];
  edges: Edge[][];
  byStation: Map<string, number[]>;
}

function buildGraph(stations: Station[], p: MetroParams): Graph {
  const nodes: Node[] = [];
  const byStation = new Map<string, number[]>();
  const byLine = new Map<string, { seq: number; node: number }[]>();
  for (const station of stations) {
    for (const l of station.lines) {
      const idx = nodes.push({ station, line: l.ref }) - 1;
      byStation.set(station.id, [...(byStation.get(station.id) ?? []), idx]);
      byLine.set(l.ref, [...(byLine.get(l.ref) ?? []), { seq: l.seq, node: idx }]);
    }
  }
  const edges: Edge[][] = nodes.map(() => []);
  const link = (a: number, b: number, e: Omit<Edge, 'to'>) => {
    edges[a].push({ to: b, ...e });
    edges[b].push({ to: a, ...e });
  };
  for (const list of byLine.values()) {
    list.sort((a, b) => a.seq - b.seq);
    for (let i = 1; i < list.length; i++) link(list[i - 1].node, list[i].node, { min: p.minPerStation, stations: 1, transfers: 0 });
  }
  for (const ids of byStation.values()) {
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) link(ids[i], ids[j], { min: p.transferMin, stations: 0, transfers: 1 });
  }
  return { nodes, edges, byStation };
}

interface Label {
  min: number;
  stations: number;
  transfers: number;
  walk: number;
  from: string;
}

/** Multi-source Dijkstra (graph has ~90 nodes, so a linear scan is plenty). */
function dijkstra(g: Graph, starts: { node: number; label: Label }[]): (Label | undefined)[] {
  const best: (Label | undefined)[] = new Array(g.nodes.length);
  const done = new Array<boolean>(g.nodes.length).fill(false);
  for (const s of starts) if (!best[s.node] || s.label.min < best[s.node]!.min) best[s.node] = s.label;
  for (;;) {
    let u = -1;
    for (let i = 0; i < best.length; i++) if (!done[i] && best[i] && (u < 0 || best[i]!.min < best[u]!.min)) u = i;
    if (u < 0) return best;
    done[u] = true;
    const lu = best[u]!;
    for (const e of g.edges[u]) {
      const cand = { min: lu.min + e.min, stations: lu.stations + e.stations, transfers: lu.transfers + e.transfers, walk: lu.walk, from: lu.from };
      if (!best[e.to] || cand.min < best[e.to]!.min) best[e.to] = cand;
    }
  }
}

export interface MetroEstimator {
  /** Precomputes the network from one origin; the returned function estimates to any destination. */
  from(origin: LatLng): (dest: LatLng) => MetroEstimate;
}

export function createMetroEstimator(stations: Station[], params: Partial<MetroParams> = {}): MetroEstimator {
  const p = { ...DEFAULT_METRO, ...params };
  const g = buildGraph(stations, p);
  return {
    from(origin) {
      const starts = nearestStations(origin, stations, p.stationsToTry).flatMap(({ station }) => {
        const walk = walkMinutes(origin, station.position, p);
        return (g.byStation.get(station.id) ?? []).map((node) => ({
          node,
          label: { min: walk + p.waitMin, stations: 0, transfers: 0, walk, from: station.name_en },
        }));
      });
      const best = dijkstra(g, starts);

      return (dest) => {
        const direct = walkMinutes(origin, dest, p);
        let result: MetroEstimate = { minutes: direct, walkMinutes: direct, walkOnly: true, stations: 0, transfers: 0 };
        for (const { station } of nearestStations(dest, stations, p.stationsToTry)) {
          const walkOut = walkMinutes(station.position, dest, p);
          for (const node of g.byStation.get(station.id) ?? []) {
            const l = best[node];
            if (!l) continue;
            const total = l.min + walkOut;
            if (total < result.minutes) {
              result = { minutes: total, walkMinutes: l.walk + walkOut, walkOnly: false, fromStation: l.from, toStation: station.name_en, stations: l.stations, transfers: l.transfers };
            }
          }
        }
        return result;
      };
    },
  };
}

export interface CarParams {
  detour: number;
  avgKmh: number;
  parkingMin: number;
}

export const DEFAULT_CAR: CarParams = { detour: 1.35, avgKmh: 35, parkingMin: 3 };

/** Rough car time when no router answers. */
export function estimateCarMinutes(a: LatLng, b: LatLng, p: CarParams = DEFAULT_CAR): number {
  return ((haversineMeters(a, b) * p.detour) / 1000 / p.avgKmh) * 60 + p.parkingMin;
}
