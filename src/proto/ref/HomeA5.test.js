import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import i18n from '../../i18n.js';
import { deriveTodayTodos, nextDaysPreview } from '../../journal/todayTodos.js';
import { createLegacySeedTrip } from '../../notebook/legacySeed.js';
import { adaptTripForNotebook } from '../../notebook/tripRate.js';
import Home, { HomeCostCard, budgetRemaining, resolveHomeCostDetail } from './Home.jsx';
import { createOsakaTrip, createRefTrip, createRefTrips, REF_TODAY } from './mockRefTrip.js';
import { fmtHKDShort } from './refLogic.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('Home A5 right-page redesign', () => {
  it('renders Home with the legacy seed trip (no next-days) and ref trip (with next-days 3 columns) on 2026-10-22 with today-todos, initial aria-checked="false", 2026年10月, and no JAPAN or OCT in zh-TW', async () => {
    await i18n.changeLanguage('zh-TW');
    const legacyTrip = adaptTripForNotebook(createLegacySeedTrip(), { today: REF_TODAY });
    const derived = deriveTodayTodos(legacyTrip, REF_TODAY);
    const preview = nextDaysPreview(legacyTrip, REF_TODAY, 3);
    expect(derived.length).toBeGreaterThan(0);
    expect(preview).toEqual([]);

    const html = renderToStaticMarkup(
      createElement(Home, {
        trip: legacyTrip,
        today: REF_TODAY,
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

    const todoButtons = [...html.matchAll(/<button\b[^>]*\bdata-testid="today-todo-([^"]+)"[^>]*>/g)];
    expect(todoButtons).toHaveLength(derived.length);
    for (const match of todoButtons) {
      expect(match[0]).toContain('role="checkbox"');
      expect(match[0]).toContain('aria-checked="false"');
    }

    expect(html).toContain('已記帳 · HKD $434');
    expect(html).toContain('>8 筆</p>');
    expect(html).toContain('data-testid="home-cost-detail-toggle"');
    expect(html).not.toContain('JPY ¥103,110 · 8 筆');
    expect(html).toContain('line-clamp-2');
    // Legacy seed trip has no days after 2026-10-22, so next-days must be absent
    expect(html).not.toContain('data-testid="next-days"');
    expect(html).toContain('一路順風');
    expect(html).toContain('data-testid="today-row"');
    expect(html).toContain('今日手札');
    expect(html).toContain('data-testid="calendar"');
    expect(html).toContain('2026年10月');
    expect(html).toContain('10月18日 – 10月27日 旅程期間');
    expect(html).not.toContain('JAPAN');
    expect(html).not.toContain(' · OCT');
    expect(html).not.toContain('OCT');

    // Ref trip from createRefTrips() adapted the same way has 2026-10-23, 2026-10-24, 2026-10-25
    const [rawRefTrip] = createRefTrips();
    const refTrip = adaptTripForNotebook(rawRefTrip, { today: REF_TODAY });
    const refPreview = nextDaysPreview(refTrip, REF_TODAY, 3);
    expect(refPreview.map((d) => d.iso)).toEqual(['2026-10-23', '2026-10-24', '2026-10-25']);

    const refHtml = renderToStaticMarkup(
      createElement(Home, {
        trip: refTrip,
        today: REF_TODAY,
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
    expect(refHtml).toContain('>富士</span>');
    expect(refHtml).not.toContain('富…');
    expect(refHtml).not.toContain('富⋯');

    await i18n.changeLanguage('en');
    const enHtml = renderToStaticMarkup(
      createElement(Home, {
        trip: createRefTrip(),
        today: REF_TODAY,
        month: '2026-10',
        setMonth: () => {},
        onOpenDay: () => {},
        onScan: () => {},
        onAdd: () => {},
      }),
    );
    expect(enHtml).toContain('Oct 2026');
    expect(enHtml).toContain('Today&#x27;s to-do');
    expect(enHtml).toContain('Next 3 days');
    expect(enHtml).toContain('Bon voyage');
    await i18n.changeLanguage('zh-TW');
  });

  it('omits today-todos when the trip day has no itinerary and omits next-days when upcoming days are empty', async () => {
    await i18n.changeLanguage('zh-TW');
    const baseTrip = adaptTripForNotebook(createLegacySeedTrip(), { today: REF_TODAY });
    const emptyDayTrip = {
      ...baseTrip,
      days: {
        '2026-10-22': {
          title: '自由活動',
          note: '東京',
          itinerary: [],
        },
      },
    };

    const html = renderToStaticMarkup(
      createElement(Home, {
        trip: emptyDayTrip,
        today: REF_TODAY,
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
    const krTrip = adaptTripForNotebook(
      {
        id: 'trip-kr-seoul',
        name: '首爾週末小旅行',
        countryCode: 'KR',
        tripCurrency: 'KRW',
        accountingCurrency: 'HKD',
        startDate: '2026-10-20',
        endDate: '2026-10-25',
        days: {
          '2026-10-20': { title: '首爾塔', note: '首爾', itinerary: [] },
          '2026-10-22': { title: '釜山海雲台', note: '釜山', itinerary: [] },
        },
        expenses: [],
      },
      { today: REF_TODAY },
    );

    const html = renderToStaticMarkup(
      createElement(Home, {
        trip: krTrip,
        today: REF_TODAY,
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
    expect(html).not.toContain('JPY ¥0');
    expect(html).not.toContain('KRW 0');
    expect(html).toContain('>0 筆</p>');

    const krTripWithSpend = adaptTripForNotebook(
      {
        id: 'trip-kr-seoul-spend',
        name: '首爾週末小旅行',
        countryCode: 'KR',
        tripCurrency: 'KRW',
        accountingCurrency: 'HKD',
        startDate: '2026-10-20',
        endDate: '2026-10-25',
        days: {},
        expenses: [
          {
            id: 'kr-1',
            date: '2026-10-22',
            store: '明洞餃子',
            category: '飲食',
            assignedTo: '共同',
            currency: 'KRW',
            originalCurrency: 'KRW',
            originalAmount: 58000,
            hkdAmount: 336,
          },
        ],
      },
      { today: REF_TODAY },
    );

    const krSpendHtml = renderToStaticMarkup(
      createElement(Home, {
        trip: krTripWithSpend,
        today: REF_TODAY,
        month: '2026-10',
        setMonth: () => {},
        onOpenDay: () => {},
        onScan: () => {},
        onAdd: () => {},
      }),
    );
    expect(krSpendHtml).toContain('>1 筆</p>');
    expect(krSpendHtml).toContain('data-testid="home-cost-detail-toggle"');
    expect(krSpendHtml).not.toContain('Stop ');

    const krDetailOpenHtml = renderToStaticMarkup(
      createElement(HomeCostCard, {
        trip: krTripWithSpend,
        today: REF_TODAY,
        open: true,
      }),
    );
    expect(krDetailOpenHtml).toContain('data-testid="home-cost-detail"');
    expect(krDetailOpenHtml).toContain('>原幣</span>');
    expect(krDetailOpenHtml).toContain('KRW 58,000');
    expect(krDetailOpenHtml).not.toContain('KRW 原幣');
    expect(krDetailOpenHtml).not.toContain('JPY 原幣');
  });

  it('A5f (a): computes budgetRemaining = budget - spent including over-budget and renders bar + remaining/over-budget in zh-TW and en', async () => {
    const under = budgetRemaining(15000, 5397);
    expect(under).toEqual({
      budget: 15000,
      spent: 5397,
      delta: 9603,
      remaining: 9603,
      over: false,
      overBy: 0,
      amount: 9603,
      pct: 36,
      barPct: 36,
    });

    const over = budgetRemaining(10000, 11222);
    expect(over).toEqual({
      budget: 10000,
      spent: 11222,
      delta: -1222,
      remaining: 0,
      over: true,
      overBy: 1222,
      amount: 1222,
      pct: 112,
      barPct: 100,
    });

    expect(budgetRemaining(null, 500)).toBeNull();
    expect(budgetRemaining(0, 500)).toBeNull();
    expect(budgetRemaining(-100, 500)).toBeNull();

    await i18n.changeLanguage('zh-TW');
    const legacyTrip = {
      ...adaptTripForNotebook(createLegacySeedTrip(), { today: REF_TODAY }),
      settings: { budget: 15000 },
    };
    const underHtml = renderToStaticMarkup(
      createElement(HomeCostCard, {
        trip: legacyTrip,
        today: REF_TODAY,
      }),
    );
    expect(underHtml).toContain('data-testid="home-budget-pill"');
    expect(underHtml).toContain('data-testid="home-budget-bar"');
    expect(underHtml).toContain('data-pct="36"');
    expect(underHtml).toContain('已用 36%');
    expect(underHtml).toContain('data-testid="home-budget-remaining"');
    expect(underHtml).toContain('剩餘 HKD $9,603');
    expect(underHtml).not.toContain('預算 HKD $15,000 · 已用 36%');

    const overTrip = {
      ...createRefTrip(),
      settings: { ...createRefTrip().settings, budget: 10000 },
    };
    const overHtml = renderToStaticMarkup(
      createElement(HomeCostCard, {
        trip: overTrip,
        today: REF_TODAY,
      }),
    );
    expect(overHtml).toContain('data-pct="100"');
    expect(overHtml).toContain('已用 112%');
    expect(overHtml).toContain('超支 HKD $1,222');
    expect(overHtml).toContain('text-stamp');

    await i18n.changeLanguage('en');
    const enUnderHtml = renderToStaticMarkup(
      createElement(HomeCostCard, {
        trip: legacyTrip,
        today: REF_TODAY,
      }),
    );
    expect(enUnderHtml).toContain('36% used');
    expect(enUnderHtml).toContain('HKD $9,603 left');

    const enOverHtml = renderToStaticMarkup(
      createElement(HomeCostCard, {
        trip: overTrip,
        today: REF_TODAY,
      }),
    );
    expect(enOverHtml).toContain('112% used');
    expect(enOverHtml).toContain('HKD $1,222 over');
    await i18n.changeLanguage('zh-TW');
  });

  it('A5f (b): hides budget bar and remaining row when trip has no budget', async () => {
    await i18n.changeLanguage('zh-TW');
    const osakaTrip = createOsakaTrip();
    const html = renderToStaticMarkup(
      createElement(Home, {
        trip: osakaTrip,
        today: '2026-11-14',
        month: '2026-11',
        setMonth: () => {},
        onOpenDay: () => {},
        onScan: () => {},
        onAdd: () => {},
      }),
    );
    expect(html).not.toContain('data-testid="home-budget-pill"');
    expect(html).not.toContain('data-testid="home-budget-bar"');
    expect(html).not.toContain('data-testid="home-budget-remaining"');
  });

  it('A5f (c): renders 明細 toggle with aria-expanded="false", >=44px tap class, today-line without day-counter prefix during trip, and detail panel when open', async () => {
    expect(fmtHKDShort(1086)).toBe('$1,086');
    expect(fmtHKDShort(0)).toBe('$0');
    expect(fmtHKDShort(11222.4)).toBe('$11,222');
    expect(fmtHKDShort(null)).toBe('$0');

    await i18n.changeLanguage('zh-TW');
    const refTrip = createRefTrip();
    const legacyTrip = adaptTripForNotebook(createLegacySeedTrip(), { today: REF_TODAY });
    const closedHtml = renderToStaticMarkup(
      createElement(HomeCostCard, {
        trip: refTrip,
        today: REF_TODAY,
        open: false,
      }),
    );
    expect(closedHtml).toContain('data-testid="trip-total"');
    expect(closedHtml).toContain('HKD $11,222');
    expect(closedHtml).toContain('>17 筆</p>');
    expect(closedHtml).toContain('data-testid="today-line"');
    expect(closedHtml).toContain('>今日 $1,086</div>');
    expect(closedHtml).not.toContain('今日 HKD $1,086');
    expect(closedHtml).not.toContain('第 5 日／共 10 日');

    const toggleMatch = closedHtml.match(/<button\b[^>]*\bdata-testid="home-cost-detail-toggle"[^>]*>/);
    expect(toggleMatch).toBeTruthy();
    expect(toggleMatch[0]).toContain('type="button"');
    expect(toggleMatch[0]).toContain('aria-expanded="false"');
    expect(toggleMatch[0]).toContain('aria-controls="home-cost-detail-panel"');
    expect(toggleMatch[0]).toMatch(/min-h-11|min-h-\[44px\]/);
    expect(closedHtml).not.toContain('data-testid="home-cost-detail"');

    const openHtml = renderToStaticMarkup(
      createElement(HomeCostCard, {
        trip: refTrip,
        today: REF_TODAY,
        open: true,
      }),
    );
    expect(openHtml).toContain('aria-expanded="true"');
    expect(openHtml).toContain('rotate-180');
    expect(openHtml).toContain('data-testid="home-cost-detail"');
    expect(openHtml).toContain('id="home-cost-detail-panel"');
    expect(openHtml).toContain('>原幣</span>');
    expect(openHtml).toContain('JPY ¥213,352');
    expect(openHtml).not.toContain('JPY 原幣');
    expect(openHtml).not.toContain('KRW 原幣');
    expect(openHtml).not.toContain('In JPY');

    const legacyOpenHtml = renderToStaticMarkup(
      createElement(HomeCostCard, {
        trip: legacyTrip,
        today: REF_TODAY,
        open: true,
      }),
    );
    expect(legacyOpenHtml).toContain('data-testid="home-cost-detail"');
    expect(legacyOpenHtml).toContain('>原幣</span>');
    expect(legacyOpenHtml).toContain('JPY ¥103,110');
    expect(legacyOpenHtml).not.toContain('JPY 原幣');
    expect(legacyOpenHtml).not.toContain('KRW 原幣');
    expect(legacyOpenHtml).not.toContain('In JPY');

    await i18n.changeLanguage('en');
    const enOpenHtml = renderToStaticMarkup(
      createElement(HomeCostCard, {
        trip: legacyTrip,
        today: REF_TODAY,
        todaySpend: 1086,
        open: true,
      }),
    );
    expect(enOpenHtml).toContain('>Today $1,086</div>');
    expect(enOpenHtml).not.toContain('Today HKD $1,086');
    expect(enOpenHtml).toContain('>Original currency</span>');
    expect(enOpenHtml).toContain('JPY ¥103,110');
    expect(enOpenHtml).not.toContain('In JPY');
    expect(enOpenHtml).not.toContain('JPY 原幣');
    expect(enOpenHtml).not.toContain('KRW 原幣');
    await i18n.changeLanguage('zh-TW');

    // Before/after trip: today-line shows short counter.label
    const beforeHtml = renderToStaticMarkup(
      createElement(HomeCostCard, {
        trip: refTrip,
        today: '2026-10-15',
      }),
    );
    expect(beforeHtml).toContain('>倒數 3 日</div>');

    const afterHtml = renderToStaticMarkup(
      createElement(HomeCostCard, {
        trip: refTrip,
        today: '2026-10-30',
      }),
    );
    expect(afterHtml).toContain('>旅程完成，共 10 日</div>');
  });

  it('A5f (d): omits 明細 toggle when trip currency is HKD or original amount is zero', async () => {
    await i18n.changeLanguage('zh-TW');
    const hkdTrip = {
      ...createRefTrip(),
      tripCurrency: 'HKD',
      currency: 'HKD',
      expenses: [
        {
          id: 'hk-1',
          date: REF_TODAY,
          store: '茶餐廳',
          category: '飲食',
          assignedTo: '共同',
          currency: 'HKD',
          originalCurrency: 'HKD',
          originalAmount: 120,
          hkdAmount: 120,
        },
      ],
    };
    expect(resolveHomeCostDetail(hkdTrip).showDetail).toBe(false);
    const hkdHtml = renderToStaticMarkup(
      createElement(HomeCostCard, {
        trip: hkdTrip,
        today: REF_TODAY,
        open: true,
      }),
    );
    expect(hkdHtml).not.toContain('data-testid="home-cost-detail-toggle"');
    expect(hkdHtml).not.toContain('data-testid="home-cost-detail"');

    const zeroJpyTrip = {
      ...createRefTrip(),
      expenses: [],
    };
    expect(resolveHomeCostDetail(zeroJpyTrip).showDetail).toBe(false);
    const zeroHtml = renderToStaticMarkup(
      createElement(HomeCostCard, {
        trip: zeroJpyTrip,
        today: REF_TODAY,
        open: true,
      }),
    );
    expect(zeroHtml).not.toContain('data-testid="home-cost-detail-toggle"');
    expect(zeroHtml).not.toContain('data-testid="home-cost-detail"');
  });

  it('keeps today-todos ticks strictly in local component state with zero localStorage or persistence calls', () => {
    const homeSrc = fs.readFileSync(path.join(repoRoot, 'src/proto/ref/Home.jsx'), 'utf8');
    const todosSrc = fs.readFileSync(path.join(repoRoot, 'src/journal/todayTodos.js'), 'utf8');

    for (const src of [homeSrc, todosSrc]) {
      expect(src).not.toMatch(/localStorage|sessionStorage|DataService|patchTrip|saveTripsData/);
      expect(src).not.toMatch(/persist/i);
    }
    expect(homeSrc).toContain('useState');
  });

  it('marks every tape element with data-jr-decor="washi" or "tape" and never mixes relative with absolute on corner tapes', async () => {
    await i18n.changeLanguage('zh-TW');
    const [rawRefTrip] = createRefTrips();
    const refTrip = adaptTripForNotebook(rawRefTrip, { today: REF_TODAY });
    const html = renderToStaticMarkup(
      createElement(Home, {
        trip: refTrip,
        today: REF_TODAY,
        month: '2026-10',
        setMonth: () => {},
        onOpenDay: () => {},
        onScan: () => {},
        onAdd: () => {},
      }),
    );

    const tapeTags = [
      ...html.matchAll(/<span\b[^>]*\bclass="[^"]*\b(?:jr-washi|jr-tape-navy)\b[^"]*"[^>]*>/g),
    ].map((m) => m[0]);
    expect(tapeTags.length).toBeGreaterThanOrEqual(10);

    for (const tag of tapeTags) {
      expect(tag).toMatch(/\bdata-jr-decor="(?:washi|tape)"/);
      if (/\babsolute\b/.test(tag)) {
        expect(tag).not.toMatch(/\brelative\b/);
      }
    }
    expect(html).not.toContain('-mt-6');
  });
});
