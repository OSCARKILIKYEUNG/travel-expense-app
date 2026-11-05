import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryPalette, fonts, palette, personPalette, themeColor, typeScale } from './tokens.js';
import tailwindConfig from '../../tailwind.config.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcRoot = path.join(repoRoot, 'src');

const PALETTE_CLASS = /(?:^|[^a-zA-Z0-9])(?:[a-z0-9-]+:)*(?:slate|gray|zinc|stone|neutral|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?\b/;
const TINY_TEXT = /text-\[(?:[0-9]|1[01])px\]/;
const TINY_FONT = /fontSize="(?:[0-9]|1[01])(?!\d)/;
const HEX = /#[0-9a-fA-F]{3,8}\b/;

const TEXT_TOKENS = [
  'ink',
  'ink-soft',
  'ink-muted',
  'route',
  'stamp',
  'teal-strong',
  'coral-ink',
  'mustard-ink',
  'sakura-ink',
  'sage-ink',
];

const JOURNAL_NEW_TOKENS = {
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
};

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function scannedSources() {
  return walk(srcRoot).filter((file) => {
    if (!/\.(js|jsx|css)$/.test(file)) return false;
    if (file.endsWith('.test.js')) return false;
    if (file.endsWith(`${path.sep}theme${path.sep}tokens.js`)) return false;
    return true;
  });
}

function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe('theme guard', () => {
  const files = scannedSources();

  it('rejects default palette classes, sub-12px text, and sub-12px svg font sizes', () => {
    const problems = [];
    for (const file of files) {
      const rel = path.relative(repoRoot, file);
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (PALETTE_CLASS.test(line)) problems.push(`${rel}:${index + 1} ${line.trim()}`);
        if (TINY_TEXT.test(line)) problems.push(`${rel}:${index + 1} tiny text`);
        if (TINY_FONT.test(line)) problems.push(`${rel}:${index + 1} tiny fontSize`);
      });
    }
    expect(problems).toEqual([]);
  });

  it('rejects hex colour literals in components, pages, proto and notebook', () => {
    const problems = [];
    for (const file of files) {
      const inUi =
        file.includes(`${path.sep}components${path.sep}`) ||
        file.includes(`${path.sep}pages${path.sep}`) ||
        file.includes(`${path.sep}proto${path.sep}`) ||
        file.includes(`${path.sep}notebook${path.sep}`);
      if (!inUi) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (HEX.test(text)) problems.push(path.relative(repoRoot, file));
    }
    expect(problems).toEqual([]);
  });

  it('pins theme-color to tokens.themeColor', () => {
    const html = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
    const vite = fs.readFileSync(path.join(repoRoot, 'vite.config.js'), 'utf8');
    const themeMeta = html.match(/name="theme-color"\s+content="([^"]+)"/);
    const manifest = vite.match(/theme_color:\s*'([^']+)'/);
    expect(themeMeta?.[1]).toBe(themeColor);
    expect(manifest?.[1]).toBe(themeColor);
  });

  it('keeps text tokens at least 4.5:1 on paper (cream) and cream-soft', () => {
    for (const key of TEXT_TOKENS) {
      expect(contrast(palette[key], palette.paper), `${key} on paper`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette[key], palette.cream), `${key} on cream`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette[key], palette['cream-soft']), `${key} on cream-soft`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('defines all journal artwork tokens with exact hex values and wires them into Tailwind colors', () => {
    const twColors = tailwindConfig?.theme?.colors || {};
    for (const [token, expectedHex] of Object.entries(JOURNAL_NEW_TOKENS)) {
      expect(palette[token], `palette.${token}`).toBe(expectedHex);
      expect(twColors[token], `tailwind colors.${token}`).toBe(`rgb(var(--c-${token}) / <alpha-value>)`);
    }
  });

  it('keeps the tinted pairs components actually use at AA (interrogate)', () => {
    const pairs = [
      ['ink-soft', 'cream'], ['ink-soft', 'cream-soft'], ['teal-strong', 'cream'], ['teal-strong', 'cream-soft'],
      ['ink', 'beige'], ['ink-muted', 'beige'], ['teal-strong', 'teal-soft'], ['coral-ink', 'coral-soft'],
      ['mustard-ink', 'mustard-soft'], ['sakura-ink', 'sakura-soft'], ['ink', 'mustard'],
      ['sage-ink', 'sage-soft'], ['ink-soft', 'sand-soft'], ['ink-muted', 'sand-soft'], ['paper', 'ribbon'],
      ['ink', 'wash-sky'], ['ink', 'wash-ochre'], ['ink-soft', 'wash-sky'], ['ink-soft', 'wash-ochre'],
      ['kraft-ink', 'kraft'],
      ['paper', 'tape-navy'], ['cream-soft', 'tape-navy'],
      ['paper', 'teal-strong'], ['cream-soft', 'teal-strong'],
    ];
    for (const [fg, bg] of pairs) {
      expect(contrast(palette[fg], palette[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    // White text on filled buttons (btn-primary, btn-danger, btn-danger-soft:hover).
    expect(contrast('#FFFFFF', palette['teal-strong'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', palette['coral-ink'])).toBeGreaterThanOrEqual(4.5);
    expect(fonts.serifDisplay[0]).toBe('"Cormorant Garamond"');
  });

  it('keeps categoryPalette and personPalette fills at least 3:1 against paper', () => {
    for (const [category, fill] of Object.entries(categoryPalette)) {
      expect(contrast(fill, palette.paper), `categoryPalette.${category} on paper`).toBeGreaterThanOrEqual(3);
    }
    expect(personPalette).toHaveLength(8);
    personPalette.forEach((fill, index) => {
      expect(contrast(fill, palette.paper), `personPalette[${index}] (${fill}) on paper`).toBeGreaterThanOrEqual(3);
    });
  });

  it('ensures src/theme/journal.css contains no raw hex and defines all required texture utilities', () => {
    const journalCssPath = path.join(srcRoot, 'theme', 'journal.css');
    expect(fs.existsSync(journalCssPath)).toBe(true);
    const css = fs.readFileSync(journalCssPath, 'utf8');
    expect(HEX.test(css)).toBe(false);
    for (const cls of ['.jr-grid', '.jr-ruled', '.jr-washi', '.jr-tape-navy', '.jr-torn', '.jr-pin', '.jr-desk', '.jr-paper', '.jr-hatch']) {
      expect(css).toContain(cls);
    }
  });

  it('defines desktop type-scale tokens (>=12px on mobile, stepped up at lg >=1024px) wired into tailwind fontSize', () => {
    const configuredSizes = tailwindConfig?.theme?.extend?.fontSize || {};
    expect(typeScale.meta).toMatchObject({ mobileSize: '12px', desktopSize: '14px' });
    expect(typeScale.sm).toMatchObject({ mobileSize: '14px', desktopSize: '15px' });
    expect(typeScale.base).toMatchObject({ mobileSize: '16px', desktopSize: '17px' });
    expect(typeScale.lg).toMatchObject({ mobileSize: '18px', desktopSize: '20px' });
    expect(typeScale.xl).toMatchObject({ mobileSize: '20px', desktopSize: '22px' });
    expect(typeScale['2xl']).toMatchObject({ mobileSize: '24px', desktopSize: '28px' });
    expect(typeScale['hero-sm']).toMatchObject({ mobileSize: '26px', desktopSize: '30px' });
    expect(typeScale['hero-lg']).toMatchObject({ mobileSize: '34px', desktopSize: '38px' });

    for (const [key, spec] of Object.entries(typeScale)) {
      const mobilePx = parseFloat(spec.mobileSize);
      const desktopPx = parseFloat(spec.desktopSize);
      expect(mobilePx, `${key} mobile >= 12px`).toBeGreaterThanOrEqual(12);
      expect(desktopPx, `${key} desktop > mobile`).toBeGreaterThan(mobilePx);
      expect(configuredSizes[key]?.[0]).toContain(`var(${spec.sizeVar}`);
    }
  });
});
