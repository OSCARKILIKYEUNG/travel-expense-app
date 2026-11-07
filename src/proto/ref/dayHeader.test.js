import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import DayView from './DayView';
import { dayStampLines, localDayStrip } from './dayHeader';
import { createRefTrip, REF_TODAY } from './mockRefTrip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('localDayStrip', () => {
  it('formats zh-TW strip with 第N天, shortened title, and HKD total', async () => {
    await i18n.changeLanguage('zh-TW');
    const t = i18n.t.bind(i18n);

    expect(
      localDayStrip({ n: 5, title: '富士山一日遊', hkd: 1086, t }),
    ).toBe('第5天・富士山一日遊・HKD $1,086');

    expect(
      localDayStrip({
        n: 5,
        title: '河口湖與富士五湖環湖巴士一日遊',
        hkd: 1086,
        t,
      }),
    ).toBe('第5天・河口湖與富士五…・HKD $1,086');
  });

  it('formats en strip with Day N, shortened title, and HKD total', async () => {
    await i18n.changeLanguage('en');
    const t = i18n.t.bind(i18n);

    expect(
      localDayStrip({ n: 5, title: '富士山一日遊', hkd: 1086, t }),
    ).toBe('Day 5・富士山一日遊・HKD $1,086');

    expect(
      localDayStrip({ n: 3, title: 'Ginza Walk', hkd: 412, t }),
    ).toBe('Day 3・Ginza W…・HKD $412');

    await i18n.changeLanguage('zh-TW');
  });

  it('omits the day part when n is null', async () => {
    await i18n.changeLanguage('zh-TW');
    const tZh = i18n.t.bind(i18n);
    expect(
      localDayStrip({ n: null, title: '自由活動', hkd: 0, t: tZh }),
    ).toBe('自由活動・HKD $0');
    expect(localDayStrip({ n: null, title: '', hkd: 0, t: tZh })).toBe(
      'HKD $0',
    );

    await i18n.changeLanguage('en');
    const tEn = i18n.t.bind(i18n);
    expect(
      localDayStrip({ n: null, title: 'Free day', hkd: 250, t: tEn }),
    ).toBe('Free day・HKD $250');
    await i18n.changeLanguage('zh-TW');
  });
});

describe('dayStampLines', () => {
  it('returns localized stamp lines in trip for zh and en', () => {
    expect(dayStampLines({ dayN: 5, m: 10, d: 22, lang: 'zh-TW' })).toEqual({
      top: '第5天',
      bottom: '10月22日',
    });
    expect(dayStampLines({ dayN: 5, m: 10, d: 22, lang: 'en' })).toEqual({
      top: 'Day 5',
      bottom: 'Oct 22',
    });
  });

  it('returns localized stamp lines outside trip (dayN = null) for zh and en', () => {
    expect(dayStampLines({ dayN: null, m: 10, d: 15, lang: 'zh-TW' })).toEqual({
      top: '10/15',
      bottom: '旅程外',
    });
    expect(dayStampLines({ dayN: null, m: 10, d: 15, lang: 'en' })).toEqual({
      top: '10/15',
      bottom: 'Off trip',
    });
  });
});

describe('DayView Batch A7 journal-artwork redesign', () => {
  it('renders localized zh-TW Day 5 badge, stamp, strip, single note WashiLabel, countBeside, and lg:hidden on expenses DayStrip', async () => {
    await i18n.changeLanguage('zh-TW');
    const trip = createRefTrip();
    const html = renderToStaticMarkup(
      createElement(DayView, {
        trip,
        iso: REF_TODAY,
        pane: 'itinerary',
        editing: false,
        onPane: () => {},
        onEditToggle: () => {},
        onBack: () => {},
        onDay: () => {},
        onUpdateDay: () => {},
        onScan: () => {},
        onAdd: () => {},
        onEditExpense: () => {},
        onDeleteExpense: () => {},
      }),
    );

    expect(html).toContain('← 月曆');
    expect(html).toContain('第5天');
    expect(html).toContain('10月22日');
    expect(html).toContain('第5天・富士山一日遊・HKD $1,086');
    expect(html).not.toContain('Day 5');
    expect(html).not.toContain('Oct 22');
    expect(html).not.toContain('月曆小字：');
    expect(html).toContain('>富士<');
    expect(html).toContain('今日行程 · 4 站');
    expect(html).toContain('lg:h-5 lg:w-5');
    expect(html).toContain('py-0.5 text-route opacity-100');
    expect(html).toContain('3 筆');
    expect(html).toContain('jr-ruled');
    expect(html).toContain('line-clamp-2');
    expect(html).toContain('data-pack="jp"');

    // pane-expenses DayStrip carries lg:hidden while pane-itinerary DayStrip does not
    const strips = [...html.matchAll(/<div[^>]*data-testid="day-strip"[^>]*>/g)].map((m) => m[0]);
    expect(strips).toHaveLength(2);
    expect(strips[0]).not.toContain('lg:hidden');
    expect(strips[1]).toContain('lg:hidden');

    // Non-Japan trip uses generic pack vignette
    const krTrip = {
      ...trip,
      id: 'trip-kr',
      name: '首爾之旅',
      countryCode: 'KR',
      tripCurrency: 'KRW',
    };
    const krHtml = renderToStaticMarkup(
      createElement(DayView, {
        trip: krTrip,
        iso: REF_TODAY,
        pane: 'itinerary',
        editing: false,
        onPane: () => {},
        onEditToggle: () => {},
        onBack: () => {},
        onDay: () => {},
        onUpdateDay: () => {},
        onScan: () => {},
        onAdd: () => {},
        onEditExpense: () => {},
        onDeleteExpense: () => {},
      }),
    );
    expect(krHtml).toContain('data-pack="generic"');
  });

  it('renders non-JP empty itinerary state without the torii doodle while keeping torii/fuji for JP', async () => {
    await i18n.changeLanguage('zh-TW');
    const baseTrip = createRefTrip();
    const emptyDays = {
      ...baseTrip.days,
      [REF_TODAY]: {
        title: '空白日',
        note: '',
        sticker: null,
        journal: '',
        itinerary: [],
      },
    };

    const jpEmptyHtml = renderToStaticMarkup(
      createElement(DayView, {
        trip: { ...baseTrip, days: emptyDays },
        iso: REF_TODAY,
        pane: 'itinerary',
        editing: false,
        onPane: () => {},
        onEditToggle: () => {},
        onBack: () => {},
        onDay: () => {},
        onUpdateDay: () => {},
        onScan: () => {},
        onAdd: () => {},
        onEditExpense: () => {},
        onDeleteExpense: () => {},
      }),
    );

    const krEmptyHtml = renderToStaticMarkup(
      createElement(DayView, {
        trip: {
          ...baseTrip,
          id: 'trip-kr',
          name: '首爾之旅',
          countryCode: 'KR',
          tripCurrency: 'KRW',
          days: emptyDays,
        },
        iso: REF_TODAY,
        pane: 'itinerary',
        editing: false,
        onPane: () => {},
        onEditToggle: () => {},
        onBack: () => {},
        onDay: () => {},
        onUpdateDay: () => {},
        onScan: () => {},
        onAdd: () => {},
        onEditExpense: () => {},
        onDeleteExpense: () => {},
      }),
    );

    // ToriiDoodle curved kasagi lintel path: "M2.8 6.4 Q12 4.2 21.2 6.4"
    const toriiKasagiPath = 'M2.8 6.4 Q12 4.2 21.2 6.4';
    const jpEmptyBlock = jpEmptyHtml.match(
      /<li[^>]*data-testid="day-itinerary-empty"[\s\S]*?<\/li>/,
    )?.[0];
    const krEmptyBlock = krEmptyHtml.match(
      /<li[^>]*data-testid="day-itinerary-empty"[\s\S]*?<\/li>/,
    )?.[0];

    expect(jpEmptyBlock).toBeTruthy();
    expect(krEmptyBlock).toBeTruthy();
    expect(jpEmptyBlock).toContain(toriiKasagiPath);
    expect(krEmptyBlock).not.toContain(toriiKasagiPath);
    // SuitcaseDoodle body rect is rendered instead for non-JP trips
    expect(krEmptyBlock).toContain('width="15" height="12"');
  });

  it('uses only journal tokens in DayView.jsx with no legacy palette classes', () => {
    const src = fs.readFileSync(path.join(__dirname, 'DayView.jsx'), 'utf8');
    expect(src).not.toMatch(/\b(?:teal|coral|mustard|cream|beige)\b/);
    expect(src).not.toMatch(/\bborder-line\b|\bbg-line\b|\bbg-white\b|\btext-white\b/);
    expect(src).not.toContain('NotchedTabBg');
  });
});
