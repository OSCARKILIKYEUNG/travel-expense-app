/** Single source of colour, type, and radius. Hex lives here. */
export const palette = {
  cream: '#F6F0E4',
  'cream-soft': '#FDFAF3',
  beige: '#EADFCB',
  line: '#DCCDB2',
  ink: '#2B2A28',
  'ink-soft': '#4A4640',
  'ink-muted': '#635D54',
  teal: '#3F7F78',
  'teal-strong': '#2C615B',
  'teal-soft': '#DCEBE6',
  sage: '#A9C3B4',
  coral: '#E0654F',
  'coral-ink': '#A93A27',
  'coral-soft': '#FBE1DA',
  mustard: '#EDB43A',
  'mustard-ink': '#7A5508',
  'mustard-soft': '#FBEFCF',
  sakura: '#F2B8C3',
  'sakura-ink': '#95425A',
  'sakura-soft': '#FCEBEF',
};

export const categoryPalette = {
  飲食: '#E0654F',
  交通: '#3F7F78',
  購物: '#C9718A',
  住宿: '#D9A030',
  娛樂: '#7E9C6B',
  其他: '#8C8478',
  未分類: '#B3AA9C',
};

export const personPalette = [
  '#2C615B',
  '#C9718A',
  '#D9A030',
  '#A93A27',
  '#7E9C6B',
  '#4A4640',
  '#3F7F78',
  '#95425A',
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
  display: ['Huninn', '"Noto Sans TC"', 'sans-serif'],
  script: ['Caveat', 'cursive'],
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

export const themeColor = palette['teal-strong'];
