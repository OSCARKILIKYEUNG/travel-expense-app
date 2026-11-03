import plugin from 'tailwindcss/plugin';
import { fonts, palette, radii, typeScale } from './src/theme/tokens.js';

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

// Central font-size utility tokens driven by `--fs-*` / `--lh-*` CSS variables.
// Below `lg` (<1024px) they resolve to baseline mobile sizes; at `@media (min-width: 1024px)`
// they step up for desktop reading distance without altering root `1rem = 16px` spacing.
const fontSize = {};
for (const [token, spec] of Object.entries(typeScale)) {
  fontSize[token] = [
    `var(${spec.sizeVar}, ${spec.mobileSize})`,
    { lineHeight: `var(${spec.lineHeightVar}, ${spec.mobileLineHeight})` },
  ];
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
        'serif-display': fonts.serifDisplay,
        script: fonts.script,
        hand: fonts.hand,
        mono: ['"SF Mono"', '"Fira Code"', '"Fira Mono"', 'Menlo', 'monospace'],
      },
      fontSize,
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
      const lgVars = {};
      for (const spec of Object.values(typeScale)) {
        vars[spec.sizeVar] = spec.mobileSize;
        vars[spec.lineHeightVar] = spec.mobileLineHeight;
        lgVars[spec.sizeVar] = spec.desktopSize;
        lgVars[spec.lineHeightVar] = spec.desktopLineHeight;
      }
      addBase({
        ':root': vars,
        '@media (min-width: 1024px)': {
          ':root': lgVars,
        },
      });
    }),
  ],
};
