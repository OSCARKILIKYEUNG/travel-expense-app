import plugin from 'tailwindcss/plugin';
import { fonts, palette, radii } from './src/theme/tokens.js';

function channels(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

const colors = {
  transparent: 'transparent',
  current: 'currentColor',
  white: '#fff',
  black: '#000',
};

for (const key of Object.keys(palette)) {
  colors[key] = `rgb(var(--c-${key}) / <alpha-value>)`;
}


/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    colors,
    extend: {
      fontFamily: {
        sans: fonts.sans,
        display: fonts.display,
        script: fonts.script,
        mono: ['"SF Mono"', '"Fira Code"', '"Fira Mono"', 'Menlo', 'monospace'],
      },
      fontSize: {
        meta: ['12px', { lineHeight: '1.45' }],
      },
      borderRadius: {
        card: radii.card,
        control: radii.control,
        pill: radii.pill,
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'spin-slow': 'spin 1s linear infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      const vars = {};
      for (const [key, hex] of Object.entries(palette)) {
        vars[`--c-${key}`] = channels(hex);
      }
      addBase({ ':root': vars });
    }),
  ],
};
