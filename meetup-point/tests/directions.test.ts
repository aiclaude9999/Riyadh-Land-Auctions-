import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { googleDirectionsUrl, googleReviewsUrl, parseOsrmRoute, stepText } from '@/lib/directions';
import { ar, en } from '@/lib/i18n';

const fx = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/osrm-route.json'), 'utf8'));

describe('parseOsrmRoute (real reply)', () => {
  const r = parseOsrmRoute(fx);
  it('gives time, distance and a line to draw', () => {
    expect(r.minutes).toBeCloseTo(942 / 60, 3);
    expect(r.km).toBeCloseTo(18.6, 1);
    expect(r.path.length).toBeGreaterThan(2);
    expect(r.path[0].lat).toBeGreaterThan(24);
  });
  it('merges repeated steps on the same road and ends with arrival', () => {
    expect(r.steps.length).toBeLessThan(16);
    const texts = r.steps.map((s) => en.carStep(s));
    expect(texts[0]).toMatch(/^Start on/);
    expect(texts.at(-1)).toBe('Arrive at the meeting place');
    expect(texts).toContain('Turn left onto طريق العروبة');
    expect(r.steps.map((s) => ar.carStep(s))).toContain('انعطف يسارًا إلى طريق العروبة');
    const total = r.steps.reduce((s, x) => s + x.meters, 0);
    expect(total).toBeCloseTo(18623.1, 0); // folding keeps the total distance
  });
});

describe('stepText', () => {
  it('handles roundabouts and unnamed roads', () => {
    expect(stepText({ distance: 0, maneuver: { type: 'roundabout', exit: 2 }, name: 'طريق' })).toBe('At the roundabout take exit 2 onto طريق');
    expect(stepText({ distance: 0, maneuver: { type: 'turn', modifier: 'right' }, name: '' })).toBe('Turn right');
  });
});

describe('Google Maps links', () => {
  it('directions use driving or transit', () => {
    expect(googleDirectionsUrl({ lat: 24.1, lng: 46.2 }, { lat: 24.3, lng: 46.4 }, 'metro')).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=24.100000,46.200000&destination=24.300000,46.400000&travelmode=transit',
    );
    expect(googleDirectionsUrl({ lat: 24.1, lng: 46.2 }, { lat: 24.3, lng: 46.4 }, 'car')).toContain('travelmode=driving');
  });
  it('reviews link searches the place name at its spot (or uses the Google id)', () => {
    expect(googleReviewsUrl('Tim Hortons', { lat: 24.7, lng: 46.6 })).toBe('https://www.google.com/maps/search/Tim%20Hortons/@24.700000,46.600000,18z');
    expect(googleReviewsUrl('X', { lat: 0, lng: 0 }, 'abc')).toContain('query_place_id=abc');
  });
});
