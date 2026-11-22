'use client';
import dynamic from 'next/dynamic';

// Leaflet needs the browser (window), so the map is rendered on the client only.
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="space-y-3" role="status" aria-label="جاري تحميل الخريطة"><div className="skeleton h-8 w-48" /><div className="skeleton h-[64dvh] lg:h-[calc(100dvh-210px)]" /></div> });

export default function MapPage() {
  return <MapView />;
}
