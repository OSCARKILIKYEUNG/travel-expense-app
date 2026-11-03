import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { categoryPalette } from '../../theme/tokens.js';
import {
  CATEGORY_ICON,
  CORE_ICONS,
  JournalIcon,
} from './core.jsx';
import {
  HatchSea,
  NavyTape,
  RouteLine,
  TodayRing,
  TornEdge,
  WashBlob,
  WashiLabel,
} from './decor.jsx';
import {
  DestinationMap,
  loadDestinationPack,
  packKeyForTrip,
  resolveDestinationArt,
} from './index.js';
import GenericPack from './packs/generic.jsx';
import JapanPack from './packs/jp.jsx';

const artDir = path.dirname(fileURLToPath(import.meta.url));
const HEX_REGEX = /#[0-9a-fA-F]{3,8}\b/;

function walkFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

describe('journal art kit (A3)', () => {
  it('maps every categoryPalette key to a CATEGORY_ICON that renders an aria-hidden <svg>', () => {
    const categoryKeys = Object.keys(categoryPalette);
    expect(categoryKeys.length).toBeGreaterThanOrEqual(7);

    for (const key of categoryKeys) {
      const IconComp = CATEGORY_ICON[key];
      expect(IconComp, `CATEGORY_ICON[${key}] should exist`).toBeTypeOf('function');

      const html = renderToStaticMarkup(createElement(IconComp));
      expect(html).toContain('<svg');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('viewBox="0 0 24 24"');

      const viaJournalIcon = renderToStaticMarkup(createElement(JournalIcon, { name: key }));
      expect(viaJournalIcon).toContain('<svg');
      expect(viaJournalIcon).toContain('aria-hidden="true"');
    }
  });

  it('renders every core icon in CORE_ICONS as a 24x24 aria-hidden <svg> and supports optional accessible title', () => {
    const requiredIcons = [
      'calendar',
      'book',
      'chart',
      'gear',
      'camera',
      'pencil',
      'pin',
      'search',
      'filter',
      'repay',
      'bowl',
      'train',
      'bag',
      'bed',
      'ticket',
      'star',
      'dot',
      'checkbox',
      'checkboxChecked',
      'triangleDown',
      'pushpin',
      'sun',
      'cloud',
      'rain',
      'suitcase',
      'plane',
      'compass',
    ];

    for (const name of requiredIcons) {
      expect(CORE_ICONS[name], `CORE_ICONS.${name} should exist`).toBeTypeOf('function');
    }

    for (const [name, IconComp] of Object.entries(CORE_ICONS)) {
      const html = renderToStaticMarkup(createElement(IconComp));
      expect(html, `${name} should render <svg>`).toMatch(/^<svg\b/);
      expect(html, `${name} should have aria-hidden="true"`).toContain('aria-hidden="true"');
      expect(html, `${name} should have focusable="false"`).toContain('focusable="false"');
      expect(html, `${name} should have 24x24 viewBox`).toContain('viewBox="0 0 24 24"');
      expect(html, `${name} should have stroke="currentColor"`).toContain('stroke="currentColor"');
      expect(html, `${name} should have stroke-width="1.5"`).toContain('stroke-width="1.5"');
    }

    const titledHtml = renderToStaticMarkup(
      createElement(JournalIcon, { name: 'camera', title: 'Scan receipt' }),
    );
    expect(titledHtml).toContain('role="img"');
    expect(titledHtml).not.toContain('aria-hidden="true"');
    expect(titledHtml).toContain('<title>Scan receipt</title>');
  });

  it('renders all decorative primitives with aria-hidden <svg> and keeps WashiLabel text accessible', () => {
    for (const tone of ['sky', 'leaf', 'berry', 'wheat']) {
      for (const shape of [1, 2, 3]) {
        const blobHtml = renderToStaticMarkup(createElement(WashBlob, { tone, shape }));
        expect(blobHtml).toContain('<svg');
        expect(blobHtml).toContain('aria-hidden="true"');
      }
    }

    const routeHtml = renderToStaticMarkup(
      createElement(RouteLine, {
        points: [
          { x: 20, y: 40 },
          { x: 80, y: 20 },
          { x: 140, y: 45 },
        ],
      }),
    );
    expect(routeHtml).toContain('<svg');
    expect(routeHtml).toContain('aria-hidden="true"');
    expect(routeHtml).toContain('stroke-dasharray="0 6"');
    expect(routeHtml).toContain('data-route-dot="0"');
    expect(routeHtml).toContain('data-route-dot="2"');

    const hatchHtml = renderToStaticMarkup(
      createElement('div', null, createElement(HatchSea), createElement(HatchSea)),
    );
    expect(hatchHtml).toContain('<svg');
    expect(hatchHtml).toContain('aria-hidden="true"');
    expect(hatchHtml).toContain('<pattern');
    expect(hatchHtml).toContain('rgb(var(--c-rule))');
    const patternIds = [...hatchHtml.matchAll(/<pattern\s+id="([^"]+)"/g)].map((m) => m[1]);
    expect(patternIds.length).toBe(2);
    expect(patternIds[0]).not.toBe(patternIds[1]);

    const washiHtml = renderToStaticMarkup(
      createElement(WashiLabel, { tilt: -2 }, '旅費手札'),
    );
    expect(washiHtml).toContain('<svg');
    expect(washiHtml).toContain('aria-hidden="true"');
    expect(washiHtml).toContain('旅費手札');
    expect(washiHtml).toContain('text-kraft-ink');
    // Outer WashiLabel element must not hide its text child from screen readers
    expect(washiHtml.startsWith('<span aria-hidden')).toBe(false);

    const navyHtml = renderToStaticMarkup(createElement(NavyTape, { tilt: 2 }));
    expect(navyHtml).toContain('<svg');
    expect(navyHtml).toContain('aria-hidden="true"');

    const ringHtml = renderToStaticMarkup(createElement(TodayRing, null, '22'));
    expect(ringHtml).toContain('<svg');
    expect(ringHtml).toContain('aria-hidden="true"');
    expect(ringHtml).toContain('rgb(var(--c-stamp))');
    expect(ringHtml).toContain('22');

    const tornHtml = renderToStaticMarkup(createElement(TornEdge));
    expect(tornHtml).toContain('<svg');
    expect(tornHtml).toContain('aria-hidden="true"');
  });

  it('resolves packKeyForTrip to jp for Tokyo trips and generic for Seoul, KR, or empty trips', () => {
    expect(packKeyForTrip({ name: '東京秋日之旅', tripCurrency: 'JPY' })).toBe('jp');
    expect(packKeyForTrip({ name: 'Tokyo & Osaka', countryCode: 'JP' })).toBe('jp');
    expect(packKeyForTrip({ name: '首爾美食之旅', tripCurrency: 'KRW' })).toBe('generic');
    expect(packKeyForTrip({ name: 'Seoul Weekend', tripCurrency: 'KRW' })).toBe('generic');
    expect(packKeyForTrip({ name: 'Busan Trip', countryCode: 'KR' })).toBe('generic');
    expect(packKeyForTrip({})).toBe('generic');
    expect(packKeyForTrip(null)).toBe('generic');
    expect(packKeyForTrip(undefined)).toBe('generic');
  });

  it('verifies GenericPack has hasCoastline === false and renders route dots only with no coastline paths', async () => {
    expect(GenericPack.code).toBeNull();
    expect(GenericPack.hasCoastline).toBe(false);
    expect(Object.keys(GenericPack.vignettes)).toEqual(['suitcase', 'plane', 'compass']);

    const loaded = await loadDestinationPack('KR');
    expect(loaded).toBe(GenericPack);

    const mapHtml = renderToStaticMarkup(
      createElement(GenericPack.Map, {
        cities: ['首爾', '釜山', '濟州'],
      }),
    );
    expect(mapHtml).not.toContain('jr-coastline');
    expect(mapHtml).not.toContain('data-map-island');
    expect(mapHtml).not.toContain('jr-coastline-honshu');
    expect(mapHtml).toContain('data-route-dot="0"');
    expect(mapHtml).toContain('data-route-dot="1"');
    expect(mapHtml).toContain('data-route-dot="2"');
    expect(mapHtml).toContain('class="sr-only"');
    expect(mapHtml).toContain('<li>首爾</li>');
    expect(mapHtml).toContain('<li>釜山</li>');
    expect(mapHtml).toContain('<li>濟州</li>');

    for (const Vig of Object.values(GenericPack.vignettes)) {
      const vigHtml = renderToStaticMarkup(createElement(Vig));
      expect(vigHtml).toContain('<svg');
      expect(vigHtml).toContain('aria-hidden="true"');
    }
  });

  it('verifies JapanPack has hasCoastline === true and renders coastline paths, HatchSea, route dots, and 9 vignettes', async () => {
    expect(JapanPack.code).toBe('JP');
    expect(JapanPack.hasCoastline).toBe(true);
    expect(Object.keys(JapanPack.vignettes)).toEqual([
      'fuji',
      'castle',
      'pagoda',
      'gate',
      'lantern',
      'latticeTower',
      'dango',
      'persimmon',
      'smallTrain',
    ]);

    const loaded = await loadDestinationPack('JP');
    expect(loaded).toBe(JapanPack);

    const mapHtml = renderToStaticMarkup(
      createElement(JapanPack.Map, {
        cities: ['tokyo', 'fuji', 'osaka'],
        labels: ['東京', '富士', '大阪'],
      }),
    );
    expect(mapHtml).toContain('jr-coastline');
    expect(mapHtml).toContain('data-map-island="honshu"');
    expect(mapHtml).toContain('data-map-island="hokkaido"');
    expect(mapHtml).toContain('data-map-island="shikoku"');
    expect(mapHtml).toContain('data-map-island="kyushu"');
    expect(mapHtml).toContain('<pattern');
    expect(mapHtml).toContain('data-route-dot="0"');
    expect(mapHtml).toContain('data-route-dot="1"');
    expect(mapHtml).toContain('data-route-dot="2"');
    expect(mapHtml).toContain('class="sr-only"');
    expect(mapHtml).toContain('<li>東京</li>');
    expect(mapHtml).toContain('<li>富士</li>');
    expect(mapHtml).toContain('<li>大阪</li>');

    for (const Vig of Object.values(JapanPack.vignettes)) {
      const vigHtml = renderToStaticMarkup(createElement(Vig));
      expect(vigHtml).toContain('<svg');
      expect(vigHtml).toContain('aria-hidden="true"');
    }

    const wrapperHtml = renderToStaticMarkup(
      createElement(DestinationMap, {
        trip: { name: '東京秋日之旅' },
        labels: ['東京', '富士', '大阪'],
      }),
    );
    expect(wrapperHtml).toContain('data-testid="destination-map"');
    expect(wrapperHtml).toContain('data-pack="jp"');
    expect(wrapperHtml).toContain('class="sr-only"');
    expect(wrapperHtml).toContain('<li>東京</li>');

    const resolvedJp = resolveDestinationArt({ name: '東京秋日之旅' });
    expect(resolvedJp.packKey).toBe('jp');
    expect(resolvedJp.hasCoastline).toBe(true);
  });

  it('contains no raw hex (#xxxxxx) in any file under src/journal/art', () => {
    const files = walkFiles(artDir);
    expect(files.length).toBeGreaterThanOrEqual(6);

    const violations = [];
    for (const file of files) {
      if (file.endsWith('.test.js')) continue;
      const content = fs.readFileSync(file, 'utf8');
      if (HEX_REGEX.test(content)) {
        violations.push(path.relative(artDir, file));
      }
    }
    expect(violations).toEqual([]);
  });
});
