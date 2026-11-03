/** Single source of colour, type, and radius. Hex lives here. */
export const palette = {
  // Journal artwork core tokens
  paper: '#FBF8F1',
  'paper-shade': '#F1EADB',
  desk: '#E7DCC8',
  rule: '#BFD0E0',
  grid: '#D5DDE8',
  route: '#1F3A68',
  'route-soft': '#DCE5F2',
  'tape-navy': '#2B4A7F',
  kraft: '#CDAE84',
  'kraft-ink': '#4A3519',
  'wash-leaf': '#8DAA78',
  'wash-berry': '#D2544E',
  'wash-wheat': '#E3B977',
  stamp: '#B23A30',

  // Remapped existing tokens for app-wide journal shift
  cream: '#FBF8F1',
  'cream-soft': '#FFFDF8',
  beige: '#F1EADB',
  line: '#D9D2C3',
  ink: '#1F1E1C',
  'ink-soft': '#45413B',
  'ink-muted': '#6A6358',
  teal: '#2B4A7F',
  'teal-strong': '#1F3A68',
  'teal-soft': '#DCE5F2',
  sage: '#8DAA78',
  coral: '#D2544E',
  'coral-ink': '#B23A30',
  'coral-soft': '#F6E0DC',
  mustard: '#E3B977',
  'mustard-ink': '#6B4818',
  'mustard-soft': '#F5EAD3',
  sakura: '#DDA5B0',
  'sakura-ink': '#7D3548',
  'sakura-soft': '#F5E4E7',
  'sage-soft': '#E6EDDF',
  'sage-ink': '#36542A',
  'sand-soft': '#F1EADB',
  'wash-sky': '#D3E4EF',
  'wash-ochre': '#EADBC2',
  ribbon: '#B23A30',
};

export const categoryPalette = {
  飲食: '#D2544E',
  交通: '#1F3A68',
  購物: '#B55D6E',
  住宿: '#A87628',
  娛樂: '#5E7F4C',
  其他: '#5E584F',
  未分類: '#8A8275',
};

export const personPalette = [
  '#1F3A68',
  '#D2544E',
  '#A87628',
  '#B23A30',
  '#5E7F4C',
  '#45413B',
  '#2B4A7F',
  '#4A3519',
];

export const chartTheme = {
  axis: palette['ink-muted'],
  grid: palette.line,
  baseline: palette['ink-soft'],
  barLabel: palette.ink,
  axisFontSize: 12,
  labelFontSize: 12,
};

export const fonts = {
  serifDisplay: [
    '"Cormorant Garamond"',
    '"Songti TC"',
    '"Hiragino Mincho ProN"',
    '"Noto Serif TC"',
    '"PMingLiU"',
    'Huninn',
    'serif',
  ],
  display: ['Huninn', '"Noto Sans TC"', 'sans-serif'],
  script: ['Caveat', 'Huninn', '"Noto Sans TC"', 'cursive'],
  hand: ['"Iansui UI"', 'Huninn', '"Noto Sans TC"', 'sans-serif'],
  sans: [
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    '"Noto Sans TC"',
    'sans-serif',
  ],
};

export const radii = {
  card: '24px',
  control: '16px',
  pill: '999px',
};

/**
 * Central desktop type scale driven by CSS custom properties (`--fs-*`, `--lh-*`).
 * Below `lg` (<1024px), mobile and tablet retain exact baseline pixel sizes.
 * At `@media (min-width: 1024px)` (`lg`), font sizes step up (`meta` 12→14px,
 * `sm` 14→15px, `base` 16→17px, headings & amounts +2–4px) while keeping root
 * `html { font-size: 16px }` fixed so rem-based spacing and tap targets never shift.
 */
export const typeScale = {
  meta: {
    sizeVar: '--fs-meta',
    lineHeightVar: '--lh-meta',
    mobileSize: '12px',
    desktopSize: '14px',
    mobileLineHeight: '1.45',
    desktopLineHeight: '1.45',
  },
  xs: {
    sizeVar: '--fs-xs',
    lineHeightVar: '--lh-xs',
    mobileSize: '12px',
    desktopSize: '14px',
    mobileLineHeight: '16px',
    desktopLineHeight: '20px',
  },
  sm: {
    sizeVar: '--fs-sm',
    lineHeightVar: '--lh-sm',
    mobileSize: '14px',
    desktopSize: '15px',
    mobileLineHeight: '20px',
    desktopLineHeight: '22px',
  },
  base: {
    sizeVar: '--fs-base',
    lineHeightVar: '--lh-base',
    mobileSize: '16px',
    desktopSize: '17px',
    mobileLineHeight: '24px',
    desktopLineHeight: '26px',
  },
  lg: {
    sizeVar: '--fs-lg',
    lineHeightVar: '--lh-lg',
    mobileSize: '18px',
    desktopSize: '20px',
    mobileLineHeight: '28px',
    desktopLineHeight: '28px',
  },
  xl: {
    sizeVar: '--fs-xl',
    lineHeightVar: '--lh-xl',
    mobileSize: '20px',
    desktopSize: '22px',
    mobileLineHeight: '28px',
    desktopLineHeight: '30px',
  },
  '2xl': {
    sizeVar: '--fs-2xl',
    lineHeightVar: '--lh-2xl',
    mobileSize: '24px',
    desktopSize: '28px',
    mobileLineHeight: '32px',
    desktopLineHeight: '34px',
  },
  'hero-sm': {
    sizeVar: '--fs-hero-sm',
    lineHeightVar: '--lh-hero-sm',
    mobileSize: '26px',
    desktopSize: '30px',
    mobileLineHeight: '1.1',
    desktopLineHeight: '1.1',
  },
  'hero-lg': {
    sizeVar: '--fs-hero-lg',
    lineHeightVar: '--lh-hero-lg',
    mobileSize: '34px',
    desktopSize: '38px',
    mobileLineHeight: '1',
    desktopLineHeight: '1',
  },
};

export const themeColor = palette['teal-strong'];
