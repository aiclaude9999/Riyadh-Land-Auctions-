/**
 * Colour themes: the default Riyadh green plus the colours of popular Saudi clubs.
 * Colours only: official club logos are registered trademarks and are not included.
 * If a club gives written permission, put its logo at public/clubs/<id>.png and set `logo: true`.
 * Colours are approximate kit colours; `brand` carries white text, so it must stay dark enough (tests check it).
 */
export interface Theme {
  id: string;
  en: string;
  ar: string;
  /** letter on the badge */
  initial: { en: string; ar: string };
  brand: string;
  dark: string;
  /** soft background for chips and highlights */
  light: string;
  /** second club colour (badge) */
  accent: string;
  logo?: boolean;
}

export const DEFAULT_THEME = 'riyadh';
export const THEME_COOKIE = 'theme';

export const THEMES: Theme[] = [
  { id: 'riyadh', en: 'Riyadh green (default)', ar: 'أخضر الرياض (الافتراضي)', initial: { en: 'R', ar: 'ر' }, brand: '#1F6F5C', dark: '#17574A', light: '#E1F0EA', accent: '#F6F0E6' },
  { id: 'hilal', en: 'Al Hilal', ar: 'الهلال', initial: { en: 'H', ar: 'هـ' }, brand: '#1D4FA0', dark: '#163D7C', light: '#E3ECF9', accent: '#FFFFFF' },
  { id: 'nassr', en: 'Al Nassr', ar: 'النصر', initial: { en: 'N', ar: 'ن' }, brand: '#1B2D5C', dark: '#121F44', light: '#FFF4C7', accent: '#FFD100' },
  { id: 'ittihad', en: 'Al Ittihad', ar: 'الاتحاد', initial: { en: 'I', ar: 'ا' }, brand: '#1A1A1A', dark: '#000000', light: '#FFF4C2', accent: '#FFCC00' },
  { id: 'ahli', en: 'Al Ahli', ar: 'الأهلي', initial: { en: 'A', ar: 'أ' }, brand: '#00703C', dark: '#005A30', light: '#DCF2E5', accent: '#FFFFFF' },
  { id: 'shabab', en: 'Al Shabab', ar: 'الشباب', initial: { en: 'S', ar: 'ش' }, brand: '#3A3A3A', dark: '#1E1E1E', light: '#ECECEC', accent: '#FFFFFF' },
  { id: 'ettifaq', en: 'Al Ettifaq', ar: 'الاتفاق', initial: { en: 'E', ar: 'ت' }, brand: '#0A7438', dark: '#07592B', light: '#FDE3E3', accent: '#D71920' },
  { id: 'qadsiah', en: 'Al Qadsiah', ar: 'القادسية', initial: { en: 'Q', ar: 'ق' }, brand: '#C8102E', dark: '#A10D25', light: '#FFF1C9', accent: '#F5B400' },
  { id: 'taawoun', en: 'Al Taawoun', ar: 'التعاون', initial: { en: 'T', ar: 'ت' }, brand: '#2A2A2A', dark: '#141414', light: '#FFF2BF', accent: '#F9C80E' },
  { id: 'fateh', en: 'Al Fateh', ar: 'الفتح', initial: { en: 'F', ar: 'ف' }, brand: '#1565C0', dark: '#0F4C94', light: '#E2EEFB', accent: '#FFFFFF' },
  { id: 'raed', en: 'Al Raed', ar: 'الرائد', initial: { en: 'R', ar: 'ر' }, brand: '#B3121F', dark: '#8E0E18', light: '#F4E1E2', accent: '#1A1A1A' },
  { id: 'fayha', en: 'Al Fayha', ar: 'الفيحاء', initial: { en: 'F', ar: 'ف' }, brand: '#C2410C', dark: '#9A3412', light: '#FFEBDD', accent: '#1E3A8A' },
];

export const themeById = (id: string | undefined): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0];

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

/** CSS variables used by the Tailwind `brand` colours (space-separated RGB so opacity works) */
export function themeVars(t: Theme): Record<string, string> {
  return { '--brand': rgb(t.brand), '--brand-dark': rgb(t.dark), '--brand-light': rgb(t.light), '--brand-accent': rgb(t.accent) };
}

/** WCAG contrast ratio between two colours */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Apply in the browser and remember (cookie, so the server paints the right colours first). */
export function applyTheme(id: string) {
  const t = themeById(id);
  const root = document.documentElement;
  root.dataset.theme = t.id;
  for (const [k, v] of Object.entries(themeVars(t))) root.style.setProperty(k, v);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.brand);
  document.cookie = `${THEME_COOKIE}=${t.id}; path=/; max-age=31536000; samesite=lax`;
}
