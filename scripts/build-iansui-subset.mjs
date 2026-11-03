/**
 * Build the Iansui UI subset WOFF2 font (`src/assets/fonts/iansui-ui.woff2`)
 * and character manifest (`scripts/iansui-subset-chars.txt`).
 *
 * Collects:
 * - Every character from all string values in `src/locales/*.json` (recursively)
 * - Every character from quoted string literals containing CJK in `src/proto/ref/journalAtlas.js`
 *   (and `src/proto/ref/mockRefTrip.js`, `src/proto/ref/index.jsx` for seeded trip/day titles)
 * - Printable ASCII U+0020–U+007E and digits
 * - Common CJK punctuation and symbols
 *
 * Environment overrides:
 * - `PYFTSUBSET`: path to `pyftsubset` binary (default: `pyftsubset`)
 * - `IANSUI_TTF`: path to source `Iansui.ttf` (default: `/tmp/fontmeasure/Iansui.ttf`)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const localesDir = path.join(repoRoot, 'src', 'locales');
const cjkSourceFiles = [
  path.join(repoRoot, 'src', 'proto', 'ref', 'journalAtlas.js'),
  path.join(repoRoot, 'src', 'proto', 'ref', 'mockRefTrip.js'),
  path.join(repoRoot, 'src', 'proto', 'ref', 'index.jsx'),
];
const charsOutputFile = path.join(repoRoot, 'scripts', 'iansui-subset-chars.txt');
const woff2OutputFile = path.join(repoRoot, 'src', 'assets', 'fonts', 'iansui-ui.woff2');

const COMMON_CJK_PUNCTUATION =
  '，。、：；！？「」『』（）·・—–－～／…⋯《》〈〉【】〔〕＋－×÷＝≠≦≧％‰°℃¥＄€£₩฿₫₱〒※✓✕✗←→↑↓↔⇄‹›«»“”‘’•';

const CJK_REGEX = /[\u3000-\u9fff\uf900-\ufaff]/;
const QUOTED_STRING_REGEX =
  /'([^'\r\n\\]*(?:\\.[^'\r\n\\]*)*)'|"([^"\r\n\\]*(?:\\.[^"\r\n\\]*)*)"/g;

function collectJsonStrings(value, charSet) {
  if (typeof value === 'string') {
    for (const ch of value) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x20) charSet.add(ch);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJsonStrings(item, charSet);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      collectJsonStrings(k, charSet);
      collectJsonStrings(v, charSet);
    }
  }
}

const charSet = new Set();

// 1. Printable ASCII U+0020–U+007E (includes digits 0–9 and basic Latin punctuation)
for (let cp = 0x0020; cp <= 0x007e; cp += 1) {
  charSet.add(String.fromCodePoint(cp));
}

// 2. Common CJK punctuation & UI symbols
for (const ch of COMMON_CJK_PUNCTUATION) {
  if (ch.codePointAt(0) >= 0x20) charSet.add(ch);
}

// 3. All strings in src/locales/*.json (recursively)
if (fs.existsSync(localesDir)) {
  const files = fs
    .readdirSync(localesDir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  for (const file of files) {
    const raw = fs.readFileSync(path.join(localesDir, file), 'utf8');
    const parsed = JSON.parse(raw);
    collectJsonStrings(parsed, charSet);
  }
}

// 4. Quoted string literals containing CJK in journalAtlas.js (plus seeded trip files)
for (const filePath of cjkSourceFiles) {
  if (!fs.existsSync(filePath)) continue;
  const src = fs.readFileSync(filePath, 'utf8');
  let match;
  while ((match = QUOTED_STRING_REGEX.exec(src)) !== null) {
    const literal = match[1] ?? match[2] ?? '';
    if (CJK_REGEX.test(literal)) {
      for (const ch of literal) {
        if (ch.codePointAt(0) >= 0x20) charSet.add(ch);
      }
    }
  }
}

const sortedChars = [...charSet]
  .sort((a, b) => a.codePointAt(0) - b.codePointAt(0))
  .join('');

fs.writeFileSync(charsOutputFile, `${sortedChars}\n`, 'utf8');

const pyftsubset = process.env.PYFTSUBSET || 'pyftsubset';
const iansuiTtf = process.env.IANSUI_TTF || '/tmp/fontmeasure/Iansui.ttf';

fs.mkdirSync(path.dirname(woff2OutputFile), { recursive: true });

execFileSync(
  pyftsubset,
  [
    iansuiTtf,
    `--text-file=${charsOutputFile}`,
    '--flavor=woff2',
    '--layout-features=*',
    '--no-layout-closure',
    '--no-hinting',
    '--desubroutinize',
    `--output-file=${woff2OutputFile}`,
  ],
  { stdio: 'inherit' },
);

const stat = fs.statSync(woff2OutputFile);
const kb = (stat.size / 1024).toFixed(2);
// eslint-disable-next-line no-console
console.log(
  `Built ${path.relative(repoRoot, woff2OutputFile)} (${stat.size} bytes / ${kb} KB, ${charSet.size} unique chars)`,
);
