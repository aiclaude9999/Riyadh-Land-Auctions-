import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: { sans: ['var(--font-ar)', 'Tahoma', 'system-ui', 'sans-serif'] },
      colors: { brand: { 50: '#eef8f3', 100: '#d5eee1', 500: '#16825d', 600: '#0f6b4c', 700: '#0b543c', 900: '#06311f' } },
    },
  },
  plugins: [],
} satisfies Config;
