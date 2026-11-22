import type { Config } from 'tailwindcss';

/**
 * Riyadh palette: palm green (brand), desert sand (background), sky blue (accent), ink (text).
 * Text never goes below 13 px (`text-xs` is 13 px here).
 */
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#1F6F5C', dark: '#17574A', light: '#E1F0EA' },
        sand: { DEFAULT: '#F6F0E6', dark: '#E9DFCF', deep: '#B88A4A' },
        sky: { DEFAULT: '#2F80C3', light: '#E4F0FA' },
        ink: { DEFAULT: '#1C2430', soft: '#5B6573' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.15rem' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,36,48,.06), 0 4px 16px rgba(28,36,48,.06)',
        sheet: '0 -8px 30px rgba(28,36,48,.18)',
      },
    },
  },
  plugins: [],
} satisfies Config;
