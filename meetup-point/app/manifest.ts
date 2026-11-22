import type { MetadataRoute } from 'next';

/** Lets phones install the app ("Add to Home Screen") so it opens full screen like a native app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Riyadh Meetup Point · ملتقى الرياض',
    short_name: 'Meetup Point',
    description: 'Find the fairest café or restaurant for your group in Riyadh.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F6F0E6',
    theme_color: '#1F6F5C',
    lang: 'en',
    dir: 'auto',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
