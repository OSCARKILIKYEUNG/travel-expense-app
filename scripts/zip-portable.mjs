/**
 * 將專案打成一份 zip（預設略過 node_modules、dist、輸出目錄，可選含 .git）。
 * 用法：node scripts/zip-portable.mjs [--with-git]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'portable-zips');

const SKIP_ROOT = new Set([
  'node_modules',
  'dist',
  'portable-zips',
  '.cursor',
]);

const withGit = process.argv.includes('--with-git');
if (!withGit) {
  SKIP_ROOT.add('.git');
}

function collectFiles(dir, relBase, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const rel = relBase ? path.join(relBase, ent.name) : ent.name;
    if (!relBase && SKIP_ROOT.has(ent.name)) {
      continue;
    }
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      collectFiles(full, rel, out);
    } else {
      out.push({ full, rel });
    }
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const zipName = `travel-expense-app-${stamp}.zip`;
fs.mkdirSync(OUT_DIR, { recursive: true });
const zipPath = path.join(OUT_DIR, zipName);

const files = [];
collectFiles(ROOT, '', files);

await new Promise((resolve, reject) => {
  const output = createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  output.on('close', () => {
    const mb = (archive.pointer() / 1024 / 1024).toFixed(2);
    // eslint-disable-next-line no-console
    console.log(`OK: ${zipPath} (${mb} MB, ${files.length} files)`);
    if (!withGit) {
      // eslint-disable-next-line no-console
      console.log('Tip: add --with-git to include .git (full version history, larger zip).');
    }
    resolve();
  });
  archive.on('error', reject);
  archive.pipe(output);
  for (const { full, rel } of files) {
    archive.file(full, { name: rel });
  }
  archive.finalize();
});
