import { describe, expect, it } from 'vitest';
import { contrast, THEMES, themeById, themeVars } from '@/lib/themes';

describe('colour themes', () => {
  it('default is Riyadh green and unknown ids fall back to it', () => {
    expect(THEMES[0].id).toBe('riyadh');
    expect(themeById('nope').id).toBe('riyadh');
    expect(themeVars(themeById('riyadh'))['--brand']).toBe('31 111 92');
  });
  it('white text stays readable on every theme’s buttons (WCAG AA ≥ 4.5)', () => {
    for (const t of THEMES) {
      expect(contrast(t.brand, '#FFFFFF'), t.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.dark, '#FFFFFF'), t.id).toBeGreaterThanOrEqual(4.5);
      // brand-coloured text on the light tint (chips)
      expect(contrast(t.dark, t.light), t.id).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('ids are unique', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
  });
});
