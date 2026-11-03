import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fonts } from './tokens.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcRoot = path.join(repoRoot, 'src');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function collectStrings(value, acc = []) {
  if (typeof value === 'string') {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, acc);
    return acc;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectStrings(v, acc);
  }
  return acc;
}

describe('font-hand (Iansui UI subset)', () => {
  it('defines fonts.hand with "Iansui UI" first and Huninn fallback', () => {
    expect(Array.isArray(fonts.hand)).toBe(true);
    expect(fonts.hand[0]).toBe('"Iansui UI"');
    expect(fonts.hand).toContain('Huninn');
  });

  it('ships src/assets/fonts/iansui-ui.woff2 under 250 KB alongside OFL license', () => {
    const woff2Path = path.join(srcRoot, 'assets', 'fonts', 'iansui-ui.woff2');
    const oflPath = path.join(srcRoot, 'assets', 'fonts', 'Iansui-OFL.txt');
    expect(fs.existsSync(woff2Path)).toBe(true);
    expect(fs.existsSync(oflPath)).toBe(true);
    const stat = fs.statSync(woff2Path);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(250 * 1024);
  });

  it('includes every CJK character (U+3400–U+9FFF) from src/locales/zh-TW.json in scripts/iansui-subset-chars.txt', () => {
    const zhTwRaw = fs.readFileSync(path.join(srcRoot, 'locales', 'zh-TW.json'), 'utf8');
    const zhTw = JSON.parse(zhTwRaw);
    const subsetChars = new Set(
      fs.readFileSync(path.join(repoRoot, 'scripts', 'iansui-subset-chars.txt'), 'utf8'),
    );

    const missing = [];
    for (const str of collectStrings(zhTw)) {
      for (const ch of str) {
        const cp = ch.codePointAt(0);
        if (cp >= 0x3400 && cp <= 0x9fff && !subsetChars.has(ch)) {
          missing.push(ch);
        }
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  it('references iansui-ui.woff2 only in src/theme/fonts.css under src/', () => {
    const fontsCssRel = path.join('src', 'theme', 'fonts.css');
    const allSrcFiles = walk(srcRoot).filter(
      (f) => /\.(js|jsx|ts|tsx|css|html|json)$/.test(f) && !f.endsWith('.test.js'),
    );
    const matches = [];
    for (const file of allSrcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('iansui-ui.woff2')) {
        matches.push(path.relative(repoRoot, file));
      }
    }
    expect(matches).toEqual([fontsCssRel]);
  });

  it('never places font-hand on a source line whose data-testid matches /total|amount/i', () => {
    const sourceFiles = walk(srcRoot).filter(
      (f) => /\.(js|jsx)$/.test(f) && !f.endsWith('.test.js'),
    );
    const violations = [];
    const testIdRegex = /data-testid=(?:["'`]([^"'`]+)["'`]|\{["'`]([^"'`]+)["'`]\})/g;

    for (const file of sourceFiles) {
      const rel = path.relative(repoRoot, file);
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, idx) => {
        if (!line.includes('font-hand')) return;
        let match;
        testIdRegex.lastIndex = 0;
        while ((match = testIdRegex.exec(line)) !== null) {
          const val = match[1] ?? match[2] ?? '';
          if (/total|amount/i.test(val)) {
            violations.push(`${rel}:${idx + 1} (${val})`);
          }
        }
      });
    }
    expect(violations).toEqual([]);
  });

  it('applies font-hand across notebook titles and labels', () => {
    const expectedFiles = [
      'src/notebook/NotebookApp.jsx',
      'src/notebook/SettingsView.jsx',
      'src/proto/ref/index.jsx',
      'src/proto/ref/Home.jsx',
      'src/proto/ref/DayView.jsx',
      'src/proto/ref/AddForm.jsx',
      'src/proto/ref/RepaymentForm.jsx',
      'src/proto/ref/Ledger.jsx',
      'src/proto/ref/LedgerTotalCard.jsx',
      'src/proto/ref/ChartsView.jsx',
      'src/proto/ref/journalAtlas.js',
    ];
    for (const rel of expectedFiles) {
      const content = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      expect(content, `${rel} should use font-hand`).toContain('font-hand');
    }
  });
});
