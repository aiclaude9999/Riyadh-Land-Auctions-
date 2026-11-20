import { describe, expect, it } from 'vitest';
import { metroRunning, prayerOverlap, riyadhClock, trafficFactor } from '@/lib/timing';

// Riyadh = UTC+3. 2026-11-18 is a Wednesday, 2026-11-20 a Friday.
const r = (local: string) => new Date(`${local}+03:00`);

describe('riyadhClock', () => {
  it('uses Riyadh time whatever the server zone', () => {
    expect(riyadhClock(new Date('2026-11-18T21:30:00Z'))).toEqual({ day: 4, minutes: 30 }); // Thu 00:30
  });
});

describe('trafficFactor (typical Riyadh traffic)', () => {
  it('rush hour on a workday is about 2× an empty road; the night is close to 1×', () => {
    expect(trafficFactor(r('2026-11-18T16:30:00'))).toBeGreaterThan(1.9);
    expect(trafficFactor(r('2026-11-18T03:00:00'))).toBeLessThan(1.1);
    expect(trafficFactor(r('2026-11-18T08:00:00'))).toBeGreaterThan(1.4);
  });
  it('weekend mornings are light', () => {
    expect(trafficFactor(r('2026-11-20T08:00:00'))).toBeLessThan(1.1);
  });
});

describe('metroRunning', () => {
  it('runs during the day, not at 3 am, and starts late on Friday', () => {
    expect(metroRunning(r('2026-11-18T09:00:00'))).toBe(true);
    expect(metroRunning(r('2026-11-18T03:00:00'))).toBe(false);
    expect(metroRunning(r('2026-11-18T05:20:00'))).toBe(false);
    expect(metroRunning(r('2026-11-18T05:40:00'))).toBe(true); // opens 5:30 Sat–Thu
    expect(metroRunning(r('2026-11-18T23:50:00'))).toBe(true);
    expect(metroRunning(r('2026-11-20T08:00:00'))).toBe(false); // Friday before 10:00
    expect(metroRunning(r('2026-11-20T11:00:00'))).toBe(true);
  });
});

describe('prayerOverlap', () => {
  it('finds Maghrib when arriving around sunset, nothing mid-morning', () => {
    expect(prayerOverlap(r('2026-11-18T17:00:00'), r('2026-11-18T17:15:00'))?.name).toBe('Maghrib');
    expect(prayerOverlap(r('2026-11-18T09:30:00'), r('2026-11-18T09:50:00'))).toBeUndefined();
  });
});

import { directionFactor, metroWaitMin } from '@/lib/timing';
describe('metro waits and traffic direction', () => {
  it('waits are shorter at peak than late at night', () => {
    expect(metroWaitMin(r('2026-11-18T08:00:00'))).toBe(3);
    expect(metroWaitMin(r('2026-11-18T12:00:00'))).toBe(4);
    expect(metroWaitMin(r('2026-11-18T23:00:00'))).toBe(5);
  });
  it('morning trips into the centre are slower, afternoon trips out of it are slower', () => {
    const suburb = { lat: 24.85, lng: 46.6 };
    const olaya = { lat: 24.7, lng: 46.68 };
    expect(directionFactor(suburb, olaya, r('2026-11-18T08:00:00'))).toBeGreaterThan(1);
    expect(directionFactor(olaya, suburb, r('2026-11-18T08:00:00'))).toBeLessThan(1);
    expect(directionFactor(olaya, suburb, r('2026-11-18T17:00:00'))).toBeGreaterThan(1);
    expect(directionFactor(olaya, suburb, r('2026-11-20T17:00:00'))).toBe(1); // Friday
  });
});
