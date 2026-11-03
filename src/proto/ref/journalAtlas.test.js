// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { createLegacySeedTrip } from '../../notebook/legacySeed';
import SettingsView from '../../notebook/SettingsView';
import Home from './Home';
import {
  CountryFlag,
  JAPAN_CITIES,
  JAPAN_MAP_VIEWBOX,
  JapanMiniMap,
  LandscapeStrip,
  editorialTrackingClass,
  projectJapanLonLat,
  resolveTripDestination,
} from './journalAtlas';
import { createOsakaTrip, createRefTrip, REF_TODAY } from './mockRefTrip';

afterEach(() => {
  cleanup();
});

describe('journalAtlas — resolveTripDestination', () => {
  it('resolves the seeded Tokyo trip to JP with localName 日本 and Tokyo/Fuji/Narita city pins', () => {
    const trip = createRefTrip();
    const dest = resolveTripDestination(trip);

    expect(dest).toBeTruthy();
    expect(dest.code).toBe('JP');
    expect(dest.isFallback).toBe(false);
    expect(dest.nameKey).toBe('notebook.journal.countries.JP.name');
    expect(dest.subtitleKey).toBe('notebook.journal.countries.JP.subtitle');
    expect(dest.localName).toBe('日本');
    expect(dest.cities.map((c) => c.id)).toEqual(['tokyo', 'fuji', 'narita']);
  });

  it('resolves the Osaka trip and legacy Tokyo seed trip to JP', () => {
    const osaka = resolveTripDestination(createOsakaTrip());
    expect(osaka.code).toBe('JP');
    expect(osaka.isFallback).toBe(false);
    expect(osaka.cities[0].id).toBe('osaka');
    expect(osaka.cities.length).toBeGreaterThanOrEqual(2);

    const legacy = resolveTripDestination(createLegacySeedTrip());
    expect(legacy.code).toBe('JP');
    expect(legacy.localName).toBe('日本');
    expect(legacy.cities.map((c) => c.id)).toEqual(['tokyo', 'fuji', 'narita']);
  });

  it('never returns null for unknown, empty, or non-Japan trips and provides a clean typographic fallback', () => {
    for (const input of [
      null,
      undefined,
      {},
      { name: '冰島環島遊', tripCurrency: 'ISK' },
      { name: 'Paris & Brussels', tripCurrency: 'EUR' },
      { name: '夾錢測試', tripCurrency: 'HKD' },
    ]) {
      const dest = resolveTripDestination(input);
      expect(dest).not.toBeNull();
      expect(dest).toBeDefined();
      expect(dest.isFallback).toBe(true);
      expect(dest.code).toBeNull();
      expect(dest.nameKey).toBe('notebook.journal.countries.generic.name');
      expect(dest.cities).toEqual([]);
    }
  });

  it('computes adaptive editorial letter-spacing classes by title length', () => {
    expect(editorialTrackingClass('JAPAN')).toBe('tracking-[0.22em]');
    expect(editorialTrackingClass('TRAVEL JOURNAL')).toBe('tracking-[0.14em]');
    expect(editorialTrackingClass('INTERNATIONAL EXPEDITION')).toBe('tracking-[0.06em]');
  });

  it('projects real lon/lat coordinates inside the viewBox with Tokyo east of Fuji and north-east of Osaka', () => {
    const byId = Object.fromEntries(JAPAN_CITIES.map((c) => [c.id, c]));

    for (const city of JAPAN_CITIES) {
      const projected = projectJapanLonLat(city.lon, city.lat);
      expect(city.x).toBe(projected.x);
      expect(city.y).toBe(projected.y);
      expect(city.x).toBeGreaterThan(0);
      expect(city.x).toBeLessThan(JAPAN_MAP_VIEWBOX.width);
      expect(city.y).toBeGreaterThan(0);
      expect(city.y).toBeLessThan(JAPAN_MAP_VIEWBOX.height);
    }

    // Tokyo (139.69E 35.69N) is east of Mt Fuji (138.73E 35.36N)
    expect(byId.tokyo.x).toBeGreaterThan(byId.fuji.x);
    expect(byId.tokyo.y).toBeLessThan(byId.fuji.y);

    // Tokyo is north-east of Osaka (135.50E 34.69N) — larger x (east), smaller y (north)
    expect(byId.tokyo.x).toBeGreaterThan(byId.osaka.x);
    expect(byId.tokyo.y).toBeLessThan(byId.osaka.y);

    // Narita (140.39E 35.77N) is east of Tokyo; Sapporo is north-east of Tokyo; Fukuoka is south-west of Osaka
    expect(byId.narita.x).toBeGreaterThan(byId.tokyo.x);
    expect(byId.sapporo.x).toBeGreaterThan(byId.tokyo.x);
    expect(byId.sapporo.y).toBeLessThan(byId.tokyo.y);
    expect(byId.fukuoka.x).toBeLessThan(byId.osaka.x);
    expect(byId.fukuoka.y).toBeGreaterThan(byId.osaka.y);
  });
});

describe('journalAtlas — CountryFlag, JapanMiniMap, and LandscapeStrip components', () => {
  it('renders CountryFlag SVG for JP with aria-hidden and zero emoji flags', () => {
    const { container } = render(createElement(CountryFlag, { code: 'JP' }));
    const svg = container.querySelector('svg[data-testid="country-flag-jp"]');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.querySelector('circle')).toBeTruthy();

    const { container: empty } = render(createElement(CountryFlag, { code: null }));
    expect(empty.firstChild).toBeNull();
  });

  it('renders JapanMiniMap with 4 islands, projected city dots, and a grouped >=12px Pacific sea label in zh-TW and EN', async () => {
    const dest = resolveTripDestination(createRefTrip());

    await i18n.changeLanguage('zh-TW');
    const tZh = i18n.getFixedT('zh-TW');
    const { container: zhContainer, unmount: uZh } = render(
      createElement(JapanMiniMap, { cities: dest.cities, t: tZh, lang: 'zh-TW' }),
    );
    const zhSvg = zhContainer.querySelector('svg[data-testid="japan-mini-map"]');
    expect(zhSvg).toBeTruthy();
    expect(zhSvg.getAttribute('aria-hidden')).toBe('true');
    expect(zhSvg.getAttribute('class')).toContain('w-[148px]');
    expect(zhSvg.getAttribute('class')).toContain('lg:w-[200px]');
    const islands = [...zhSvg.querySelectorAll('path[data-map-island]')].map((el) =>
      el.getAttribute('data-map-island'),
    );
    expect(islands).toEqual(['hokkaido', 'honshu', 'shikoku', 'kyushu']);
    const cityGroups = [...zhSvg.querySelectorAll('g[data-map-city]')].map((el) =>
      el.getAttribute('data-map-city'),
    );
    expect(cityGroups).toEqual(['tokyo', 'fuji', 'narita']);
    expect(zhSvg.querySelectorAll('line, polyline').length).toBeGreaterThanOrEqual(1);

    const zhTexts = [...zhSvg.querySelectorAll('text')];
    expect(zhTexts.map((el) => el.textContent)).toEqual(['東京・富士']);
    for (const textEl of zhTexts) {
      const fsAttr = textEl.getAttribute('font-size') || textEl.getAttribute('fontSize');
      expect(Number(fsAttr)).toBeGreaterThanOrEqual(12);
    }
    uZh();

    await i18n.changeLanguage('en');
    const tEn = i18n.getFixedT('en');
    const { container: enContainer, unmount: uEn } = render(
      createElement(JapanMiniMap, { cities: dest.cities, t: tEn, lang: 'en' }),
    );
    const enTexts = [...enContainer.querySelectorAll('text')];
    expect(enTexts.map((el) => el.textContent)).toEqual(['TOKYO · FUJI']);
    uEn();

    await i18n.changeLanguage('zh-TW');
  });

  it('renders LandscapeStrip SVG fallback by default and supports optional WebP src with error fallback', () => {
    const { container: fallbackContainer, unmount: u1 } = render(createElement(LandscapeStrip));
    const strip = fallbackContainer.querySelector('[data-testid="landscape-strip"]');
    expect(strip).toBeTruthy();
    expect(strip.getAttribute('aria-hidden')).toBe('true');
    const stripSvg = strip.querySelector('svg');
    expect(stripSvg).toBeTruthy();
    expect(stripSvg.getAttribute('viewBox')).toBe('-321 0 1000 68');
    expect(stripSvg.getAttribute('preserveAspectRatio')).toBe('xMidYMid slice');
    expect(strip.querySelector('img')).toBeNull();
    u1();

    const { container: imgContainer, unmount: u2 } = render(
      createElement(LandscapeStrip, { src: '/journal-art/jp-fuji-coast.webp' }),
    );
    const img = imgContainer.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('/journal-art/jp-fuji-coast.webp');
    fireEvent.error(img);
    expect(imgContainer.querySelector('svg')).toBeTruthy();
    u2();
  });

  it('renders Home cover card with SVG flag, spaced serif JAPAN title, JapanMiniMap, LandscapeStrip, and decluttered chrome', async () => {
    const trip = createRefTrip();
    await i18n.changeLanguage('zh-TW');
    const { unmount: uHomeZh } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(Home, {
          trip,
          today: REF_TODAY,
          month: '2026-10',
          setMonth: () => {},
          onOpenDay: () => {},
          onScan: () => {},
          onAdd: () => {},
        }),
      ),
    );

    const summary = screen.getByTestId('summary');
    expect(summary.textContent).toContain('JAPAN');
    expect(summary.textContent).toContain('日本');
    expect(summary.textContent).toContain('東京秋日之旅');
    expect(summary.textContent).toContain('目的地：日本（東京, 富士, 成田）');
    expect(screen.getByTestId('country-flag-jp')).toBeTruthy();
    expect(screen.getByTestId('japan-mini-map')).toBeTruthy();
    expect(screen.getByTestId('landscape-strip')).toBeTruthy();
    expect(screen.getByTestId('trip-total').textContent).toBe('HKD $11,222');
    expect(screen.getByTestId('today-line').textContent).toContain('HKD $1,086');
    expect(screen.getByTestId('today-row')).toBeTruthy();
    expect(screen.getByTestId('calendar')).toBeTruthy();
    uHomeZh();

    // Unknown destination fallback renders plain typographic header without flag or map
    const unknownTrip = {
      ...trip,
      id: 'trip-iceland',
      name: '冰島環島遊',
      tripCurrency: 'ISK',
      days: {},
      expenses: [],
    };
    const { unmount: uUnknown } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(Home, {
          trip: unknownTrip,
          today: REF_TODAY,
          month: '2026-10',
          setMonth: () => {},
          onOpenDay: () => {},
          onScan: () => {},
          onAdd: () => {},
        }),
      ),
    );
    expect(screen.getByTestId('summary').textContent).toContain('TRAVEL JOURNAL');
    expect(screen.getByTestId('summary').textContent).toContain('冰島環島遊');
    expect(screen.queryByTestId('country-flag-jp')).toBeNull();
    expect(screen.queryByTestId('japan-mini-map')).toBeNull();
    expect(screen.getByTestId('landscape-strip')).toBeTruthy();
    uUnknown();
  });

  it('displays translated Shared label for 共同 in SettingsView people list in EN while keeping internal key intact', async () => {
    const trip = createRefTrip();
    await i18n.changeLanguage('en');
    const { unmount } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(SettingsView, {
          trip,
          trips: [trip],
          today: REF_TODAY,
          uiLanguage: 'en',
          onUpdateTrip: () => {},
          onSelectTrip: () => {},
        }),
      ),
    );

    const sharedRow = screen.getByTestId('person-row-共同');
    expect(sharedRow.textContent).toContain('Shared');
    expect(sharedRow.textContent).toContain('Default');
    expect(sharedRow.textContent).not.toContain('共同');
    expect(screen.queryByTestId('person-edit-共同')).toBeNull();
    expect(screen.queryByTestId('person-remove-共同')).toBeNull();

    const oscarEdit = screen.getByTestId('person-edit-Oscar');
    expect(oscarEdit.getAttribute('aria-label')).toBe('Rename Oscar');
    unmount();

    await i18n.changeLanguage('zh-TW');
  });
});
