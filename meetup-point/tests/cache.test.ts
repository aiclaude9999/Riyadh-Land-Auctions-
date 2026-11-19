import { describe, expect, it } from 'vitest';
import { TtlCache } from '@/lib/cache';

describe('TtlCache', () => {
  it('expires entries after the TTL', () => {
    let now = 0;
    const c = new TtlCache<number>(1000, 10, () => now);
    c.set('a', 1);
    now = 999;
    expect(c.get('a')).toBe(1);
    now = 1000;
    expect(c.get('a')).toBeUndefined();
  });

  it('drops the oldest entry when full', () => {
    const c = new TtlCache<number>(1000, 2);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('c')).toBe(3);
  });
});
