import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { palette, themeColor } from './tokens.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcRoot = path.join(repoRoot, 'src');

const PALETTE_CLASS = /(?:^|[^a-zA-Z0-9])(?:[a-z0-9-]+:)*(?:slate|gray|zinc|stone|neutral|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?\b/;
const TINY_TEXT = /text-\[(?:[0-9]|1[01])px\]/;
const TINY_FONT = /fontSize="(?:[0-9]|1[01])(?!\d)/;
const HEX = /#[0-9a-fA-F]{3,8}\b/;

const TEXT_TOKENS = ['ink', 'ink-soft', 'ink-muted', 'teal-strong', 'coral-ink', 'mustard-ink', 'sakura-ink'];

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

  it('rejects hex colour literals in components, pages and proto', () => {
    const problems = [];
    for (const file of files) {
      const inUi = file.includes(`${path.sep}components${path.sep}`) || file.includes(`${path.sep}pages${path.sep}`) || file.includes(`${path.sep}proto${path.sep}`);
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

  it('keeps text tokens at least 4.5:1 on cream and cream-soft', () => {
    for (const key of TEXT_TOKENS) {
      expect(contrast(palette[key], palette.cream)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette[key], palette['cream-soft'])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the tinted pairs components actually use at AA (interrogate)', () => {
    const pairs = [
      ['ink', 'beige'], ['ink-muted', 'beige'], ['teal-strong', 'teal-soft'], ['coral-ink', 'coral-soft'],
      ['mustard-ink', 'mustard-soft'], ['sakura-ink', 'sakura-soft'], ['ink', 'mustard'],
    ];
    for (const [fg, bg] of pairs) {
      expect(contrast(palette[fg], palette[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    // White text on filled buttons (btn-primary, btn-danger, btn-danger-soft:hover).
    expect(contrast('#FFFFFF', palette['teal-strong'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', palette['coral-ink'])).toBeGreaterThanOrEqual(4.5);
  });
});
