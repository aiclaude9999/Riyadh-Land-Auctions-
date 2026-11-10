'use client';
import dynamic from 'next/dynamic';

// Leaflet needs the browser (window), so the map is rendered on the client only.
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="muted p-6">جاري تحميل الخريطة…</div> });

export default function MapPage() {
  return <MapView />;
}
