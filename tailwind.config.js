/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          dark: '#050505',
          card: '#11100f',
          light: '#f1eee6',
          lightCard: '#e6e3da',
        },
        ink: {
          dark: '#050505',
          light: '#f1eee6',
          mutedDark: '#66625b',
          mutedLight: '#aaa79f',
          subtle: '#8a867c',
        },
        thread: {
          DEFAULT: '#ff3b12',
          glow: 'rgba(255, 59, 18, 0.4)',
          subtle: 'rgba(255, 59, 18, 0.15)',
        },
        gold: {
          DEFAULT: '#d4af37',
          light: '#e5c05b',
        },
        emerald: {
          DEFAULT: '#10b981',
          dark: '#104a37',
          deep: '#0b3326',
        },
        border: {
          dark: 'rgba(241, 238, 230, 0.12)',
          darkActive: 'rgba(241, 238, 230, 0.35)',
          light: 'rgba(5, 5, 5, 0.12)',
          lightActive: 'rgba(5, 5, 5, 0.35)',
        }
      },
      fontFamily: {
        archivo: ['Archivo', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['Cinzel', 'Playfair Display', 'serif'],
      },
      letterSpacing: {
        tightest: '-0.045em',
        tighter: '-0.03em',
        tight: '-0.02em',
        wideMono: '0.12em',
      },
    },
  },
  plugins: [],
};

