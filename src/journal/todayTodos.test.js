import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import i18n from '../i18n.js';
import { createLegacySeedTrip, createLegacySeedTrips } from '../notebook/legacySeed.js';
import { adaptTripForNotebook } from '../notebook/tripRate.js';
import Home from '../proto/ref/Home.jsx';
import { createRefTrips, REF_TODAY } from '../proto/ref/mockRefTrip.js';
import { deriveTodayTodos, nextDaysPreview } from './todayTodos.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('todayTodos — deriveTodayTodos', () => {
  it('derives today todos for createRefTrips() and createLegacySeedTrips() on 2026-10-22 with matched spentHkd', () => {
    const [refTokyo, refOsaka] = createRefTrips();
    const refTodos = deriveTodayTodos(refTokyo, REF_TODAY);

    expect(refTodos).toEqual([
      {
        id: 's9',
        time: '07:30',
        title: '新宿 高速巴士出發',
      },
      {
        id: 's10',
        time: '10:00',
        title: '河口湖站 寄存行李',
        spentHkd: 263,
      },
      {
        id: 's11',
        time: '11:30',
        title: '天上山纜車 看富士山',
        spentHkd: 434,
      },
      {
        id: 's12',
        time: '',
        title: '晚餐 ほうとう不動',
        spentHkd: 389,
      },
    ]);

    // Osaka trip is in Nov 2026, so 2026-10-22 is outside trip
    expect(deriveTodayTodos(refOsaka, REF_TODAY)).toEqual([]);

    const [legacyTrip] = createLegacySeedTrips();
    const legacyTodos = deriveTodayTodos(legacyTrip, REF_TODAY);
    expect(legacyTodos).toEqual([
      {
        id: 'ls5',
        time: '07:30',
        title: '新宿 高速巴士出發',
      },
      {
        id: 'ls6',
        time: '11:30',
        title: '天上山纜車 看富士山',
        spentHkd: 434,
      },
    ]);
  });

  it('sorts normal day stops by time ascending while preserving stable order for ties and untimed stops', () => {
    const trip = {
      startDate: '2026-10-18',
      endDate: '2026-10-27',
      days: {
        '2026-10-22': {
          title: '京都散策',
          itinerary: [
            { id: 'c', time: '14:00', title: '清水寺', place: '東山' },
            { id: 'u1', time: '', title: '夜間散步' },
            { id: 'a', time: '09:00', title: '伏見稻荷' },
            { id: 'b1', time: '11:30', title: '錦市場 午餐' },
            { id: 'b2', time: '11:30', title: '錦天滿宮' },
            { id: 'u2', time: '', title: '宵夜拉麵' },
          ],
        },
      },
      expenses: [
        { id: 'e1', date: '2026-10-22', store: '清水寺 門票', hkdAmount: 25 },
        { id: 'e2', date: '2026-10-22', store: '清水寺 茶屋', hkdAmount: 45 },
      ],
    };

    const todos = deriveTodayTodos(trip, '2026-10-22');
    expect(todos.map((x) => x.id)).toEqual(['a', 'b1', 'b2', 'c', 'u1', 'u2']);
    expect(todos[3]).toEqual({
      id: 'c',
      time: '14:00',
      title: '清水寺',
      place: '東山',
      spentHkd: 70,
    });
    expect('spentHkd' in todos[0]).toBe(false);
  });

  it('returns empty array for empty itinerary, missing day, or today outside trip range', () => {
    const trip = {
      startDate: '2026-10-18',
      endDate: '2026-10-20',
      days: {
        '2026-10-18': { title: 'Day 1', itinerary: [] },
        '2026-10-20': { title: 'Day 3', itinerary: [{ id: '1', time: '10:00', title: 'Airport' }] },
      },
    };

    // Empty itinerary
    expect(deriveTodayTodos(trip, '2026-10-18')).toEqual([]);
    // Missing day inside trip range
    expect(deriveTodayTodos(trip, '2026-10-19')).toEqual([]);
    // Today before trip startDate
    expect(deriveTodayTodos(trip, '2026-10-17')).toEqual([]);
    // Today after trip endDate
    expect(deriveTodayTodos(trip, '2026-10-21')).toEqual([]);
    // Null / invalid inputs
    expect(deriveTodayTodos(null, '2026-10-18')).toEqual([]);
    expect(deriveTodayTodos(trip, '')).toEqual([]);
    expect(deriveTodayTodos(trip, 'invalid-date')).toEqual([]);
  });

  it('tolerates malformed stop objects without throwing', () => {
    const trip = {
      startDate: '2026-10-18',
      endDate: '2026-10-27',
      days: {
        '2026-10-22': {
          itinerary: [
            null,
            undefined,
            'not-an-object',
            {},
            { id: 'empty-title', time: '08:00', title: '   ' },
            { time: 930, title: 'Missing ID & numeric time' },
            { id: 'bad-time', time: '99:99', place: 'Only place provided' },
            { id: 'valid', time: '08:15', title: 'Morning coffee' },
          ],
        },
      },
    };

    const todos = deriveTodayTodos(trip, '2026-10-22');
    expect(todos).toEqual([
      {
        id: 'valid',
        time: '08:15',
        title: 'Morning coffee',
      },
      {
        id: 'todo-2026-10-22-5',
        time: '',
        title: 'Missing ID & numeric time',
      },
      {
        id: 'bad-time',
        time: '99:99',
        title: 'Only place provided',
        place: 'Only place provided',
      },
    ]);
  });
});

describe('todayTodos — nextDaysPreview', () => {
  it('returns up to n following trip days in chronological order from createRefTrips() and createLegacySeedTrips()', () => {
    const [refTokyo] = createRefTrips();
    const preview3 = nextDaysPreview(refTokyo, REF_TODAY);

    expect(preview3).toHaveLength(3);
    expect(preview3.map((d) => d.iso)).toEqual(['2026-10-23', '2026-10-24', '2026-10-25']);
    expect(preview3[0]).toEqual({
      iso: '2026-10-23',
      weekdayIndex: 5, // Friday
      title: '橫濱半日',
      stops: ['橫濱 港未來'],
    });
    expect(preview3[1]).toEqual({
      iso: '2026-10-24',
      weekdayIndex: 6, // Saturday
      title: '箱根溫泉',
      stops: ['箱根湯本'],
    });
    expect(preview3[2]).toEqual({
      iso: '2026-10-25',
      weekdayIndex: 0, // Sunday
      title: '返回東京',
      stops: ['小田急浪漫特快'],
    });

    // Respects custom limit n = 2
    expect(nextDaysPreview(refTokyo, REF_TODAY, 2)).toHaveLength(2);

    // Legacy seed trip from 2026-10-18 skips missing 2026-10-19 and returns 20, 21, 22
    const [legacyTrip] = createLegacySeedTrips();
    const legacyPreview = nextDaysPreview(legacyTrip, '2026-10-18', 3);
    expect(legacyPreview.map((d) => d.iso)).toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
    expect(legacyPreview[2].stops).toEqual(['新宿 高速巴士出發', '天上山纜車 看富士山']);

    // Legacy seed trip has no days after 2026-10-22 (zero invented fallback days)
    expect(nextDaysPreview(legacyTrip, REF_TODAY, 3)).toEqual([]);
  });

  it('skips empty days, orders stops by time, and handles edge limits', () => {
    const fixtureTrip = {
      startDate: '2026-10-18',
      endDate: '2026-10-27',
      days: {
        '2026-10-23': { title: '', note: '', sticker: null, journal: '', itinerary: [] },
        '2026-10-24': null,
        '2026-10-25': {
          title: '京都一日',
          itinerary: [
            { id: '2', time: '15:00', title: '伏見稻荷' },
            { id: '1', time: '09:30', title: '嵐山' },
          ],
        },
        '2026-10-26': {
          title: '大阪美食',
          note: '道頓堀',
          itinerary: [],
        },
        '2026-10-29': {
          title: 'Out of trip range',
          itinerary: [{ id: '3', time: '10:00', title: 'Should be excluded' }],
        },
      },
    };

    const preview = nextDaysPreview(fixtureTrip, '2026-10-22', 3);
    expect(preview).toEqual([
      {
        iso: '2026-10-25',
        weekdayIndex: 0,
        title: '京都一日',
        stops: ['嵐山', '伏見稻荷'],
      },
      {
        iso: '2026-10-26',
        weekdayIndex: 1,
        title: '大阪美食',
        stops: ['道頓堀'],
      },
    ]);

    expect(nextDaysPreview(fixtureTrip, '2026-10-22', 0)).toEqual([]);
    expect(nextDaysPreview(null, '2026-10-22', 3)).toEqual([]);
  });
});

describe('Home A5 right-page & today-todos integration', () => {
  it('renders Home with the legacy seed trip on 2026-10-22 with today-todos, initial aria-checked="false", no next-days card (no days after 10-22), 2026年10月, and no JAPAN or OCT in zh-TW', async () => {
    await i18n.changeLanguage('zh-TW');
    const legacyTrip = adaptTripForNotebook(createLegacySeedTrip(), { today: '2026-10-22' });
    const derived = deriveTodayTodos(legacyTrip, '2026-10-22');
    expect(derived.length).toBeGreaterThan(0);
    expect(nextDaysPreview(legacyTrip, '2026-10-22', 3)).toEqual([]);

    const html = renderToStaticMarkup(
      createElement(Home, {
        trip: legacyTrip,
        today: '2026-10-22',
        month: '2026-10',
        setMonth: () => {},
        onOpenDay: () => {},
        onScan: () => {},
        onAdd: () => {},
      }),
    );

    expect(html).toContain('data-testid="today-todos"');
    for (const item of derived) {
      expect(html).toContain(`data-testid="today-todo-${item.id}"`);
    }
    const todoMatches = [...html.matchAll(/<button\b[^>]*\bdata-testid="today-todo-([^"]+)"[^>]*>/g)];
    expect(todoMatches).toHaveLength(derived.length);
    for (const match of todoMatches) {
      expect(match[0]).toContain('role="checkbox"');
      expect(match[0]).toContain('aria-checked="false"');
    }

    // Legacy seed trip has no days after 2026-10-22, so next-days card must be absent
    expect(html).not.toContain('data-testid="next-days"');
    expect(html).toContain('一路順風');
    expect(html).toContain('2026年10月');
    expect(html).toContain('10月18日 – 10月27日 旅程期間');
    expect(html).not.toContain('JAPAN');
    expect(html).not.toContain(' · OCT');
    expect(html).not.toContain('OCT');

    // Ref trip from createRefTrips() adapted the same way has 2026-10-23, 2026-10-24, 2026-10-25
    const [rawRefTrip] = createRefTrips();
    const refTrip = adaptTripForNotebook(rawRefTrip, { today: '2026-10-22' });
    const refPreview = nextDaysPreview(refTrip, '2026-10-22', 3);
    expect(refPreview.map((d) => d.iso)).toEqual(['2026-10-23', '2026-10-24', '2026-10-25']);

    const refHtml = renderToStaticMarkup(
      createElement(Home, {
        trip: refTrip,
        today: '2026-10-22',
        month: '2026-10',
        setMonth: () => {},
        onOpenDay: () => {},
        onScan: () => {},
        onAdd: () => {},
      }),
    );
    expect(refHtml).toContain('data-testid="next-days"');
    expect(refHtml).toContain('接下來三日行程');
    expect(refHtml).toContain('10月23日 – 10月25日');
    expect(refHtml).toContain('23日（五）');
    expect(refHtml).toContain('24日（六）');
    expect(refHtml).toContain('25日（日）');
    expect(refHtml).toContain('橫濱 港未來');
    expect(refHtml).toContain('箱根湯本');
    expect(refHtml).toContain('小田急浪漫特快');
  });

  it('omits today-todos card when the trip day has no itinerary', async () => {
    await i18n.changeLanguage('zh-TW');
    const baseTrip = adaptTripForNotebook(createLegacySeedTrip(), { today: '2026-10-22' });
    const noItineraryTrip = {
      ...baseTrip,
      days: {
        ...baseTrip.days,
        '2026-10-22': {
          ...baseTrip.days['2026-10-22'],
          itinerary: [],
        },
      },
    };

    const html = renderToStaticMarkup(
      createElement(Home, {
        trip: noItineraryTrip,
        today: '2026-10-22',
        month: '2026-10',
        setMonth: () => {},
        onOpenDay: () => {},
        onScan: () => {},
        onAdd: () => {},
      }),
    );

    expect(html).not.toContain('data-testid="today-todos"');
    expect(html).not.toContain('data-testid="today-todo-');
  });

  it('renders a non-Japan trip (Seoul/KR fixture) with generic route-dots map (destination-map-generic) and no coastline', async () => {
    await i18n.changeLanguage('zh-TW');
    const seoulTrip = adaptTripForNotebook(
      {
        id: 'trip-kr-seoul-2026',
        name: '首爾秋日美食之旅',
        countryCode: 'KR',
        tripCurrency: 'KRW',
        accountingCurrency: 'HKD',
        startDate: '2026-10-18',
        endDate: '2026-10-24',
        days: {
          '2026-10-18': { title: '抵達首爾', note: '明洞', itinerary: [] },
          '2026-10-20': { title: '釜山一日', note: '釜山', itinerary: [] },
          '2026-10-22': { title: '弘大散步', note: '弘大', itinerary: [] },
        },
        expenses: [],
      },
      { today: '2026-10-22' },
    );

    const html = renderToStaticMarkup(
      createElement(Home, {
        trip: seoulTrip,
        today: '2026-10-22',
        month: '2026-10',
        setMonth: () => {},
        onOpenDay: () => {},
        onScan: () => {},
        onAdd: () => {},
      }),
    );

    expect(html).toContain('data-testid="destination-map"');
    expect(html).toContain('data-pack="generic"');
    expect(html).toContain('data-testid="destination-map-generic"');
    expect(html).not.toContain('destination-map-jp');
    expect(html).not.toContain('japan-mini-map');
    expect(html).not.toContain('jr-coastline');
    expect(html).not.toContain('data-map-island');
  });

  it('never writes localStorage or persists todo state in Home or todayTodos modules', () => {
    const homeSrc = fs.readFileSync(path.join(repoRoot, 'src/proto/ref/Home.jsx'), 'utf8');
    const todosSrc = fs.readFileSync(path.join(repoRoot, 'src/journal/todayTodos.js'), 'utf8');

    for (const src of [homeSrc, todosSrc]) {
      expect(src).not.toMatch(/localStorage|sessionStorage|DataService|patchTrip|saveTripsData/);
      expect(src).not.toMatch(/persist/i);
    }
    expect(homeSrc).toContain('useState');
  });
});
