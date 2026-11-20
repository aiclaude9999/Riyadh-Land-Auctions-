import { readFileSync } from 'node:fs';
import path from 'node:path';
import MeetupApp from '@/components/MeetupApp';
import type { StationCollection } from '@/lib/metro';
import type { MetroLineCollection } from '@/components/MetroLayer';
import type { District } from '@/lib/districts';

// The metro files are static: read once at build/render time on the server and pass to the client.
function readGeoJson<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), 'data', file), 'utf8')) as T;
}

export default function Page() {
  const stations = readGeoJson<StationCollection>('metro-stations.geojson');
  const lines = readGeoJson<MetroLineCollection>('metro-lines.geojson');
  const { districts } = readGeoJson<{ districts: District[] }>('riyadh-districts.json');
  return <MeetupApp stations={stations} lines={lines} districts={districts} />;
}
