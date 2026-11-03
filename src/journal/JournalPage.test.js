import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import i18n from '../i18n.js';
import NotebookApp from '../notebook/NotebookApp.jsx';
import { createRefTrip } from '../proto/ref/mockRefTrip.js';
import * as parts from '../proto/ref/parts.jsx';
import JournalPage, { SPREAD_GUTTER_CALC } from './JournalPage.jsx';
import { formatPageDateLine, pageNumberForTab } from './pageMeta.js';

const journalDir = path.dirname(fileURLToPath(import.meta.url));
const HEX_REGEX = /#[0-9a-fA-F]{3,8}\b/;

describe('JournalPage & pageMeta (A4 part a)', () => {
  it('renders children unchanged between page header and footer', async () => {
    await i18n.changeLanguage('zh-TW');
    const html = renderToStaticMarkup(
      createElement(
        JournalPage,
        {
          pageNumber: 1,
          dateLine: '2026年10月22日 星期四 · 第5天',
          spread: 'home',
        },
        createElement('section', { 'data-testid': 'sample-child' }, 'Child body content'),
      ),
    );

    expect(html).toContain('2026年10月22日 星期四 · 第5天');
    expect(html).toContain('<section data-testid="sample-child">Child body content</section>');
    expect(html).toContain('手繪旅帳 · 第 1 頁');

    const headerIdx = html.indexOf('2026年10月22日 星期四 · 第5天');
    const childIdx = html.indexOf('data-testid="sample-child"');
    const footerIdx = html.indexOf('手繪旅帳 · 第 1 頁');
    expect(headerIdx).toBeGreaterThanOrEqual(0);
    expect(childIdx).toBeGreaterThan(headerIdx);
    expect(footerIdx).toBeGreaterThan(childIdx);
  });

  it('marks every decorative node and SVG as aria-hidden="true" and pointer-events-none', () => {
    const html = renderToStaticMarkup(
      createElement(
        JournalPage,
        {
          pageNumber: 2,
          dateLine: '2026年10月22日 星期四 · 第5天',
          spread: 'ledger',
        },
        createElement('p', null, 'Ledger body'),
      ),
    );

    const decorTags = [...html.matchAll(/<([a-z0-9]+)\b[^>]*\bdata-jr-decor="([^"]+)"[^>]*>/gi)];
    const decorNames = decorTags.map((m) => m[2]).sort();
    expect(decorNames).toEqual(['binding', 'curl', 'gutter', 'ribbon', 'washi']);

    for (const match of decorTags) {
      const openingTag = match[0];
      const name = match[2];
      expect(openingTag, `decor ${name} must be aria-hidden`).toContain('aria-hidden="true"');
      expect(openingTag, `decor ${name} must be pointer-events-none`).toContain('pointer-events-none');
    }

    const svgTags = [...html.matchAll(/<svg\b[^>]*>/gi)].map((m) => m[0]);
    expect(svgTags.length).toBeGreaterThanOrEqual(3);
    for (const svgTag of svgTags) {
      expect(svgTag).toContain('aria-hidden="true"');
      expect(svgTag).toContain('focusable="false"');
    }
  });

  it('adds no data-testid anywhere in the frame markup', () => {
    const html = renderToStaticMarkup(
      createElement(
        JournalPage,
        {
          pageNumber: 1,
          dateLine: '2026年10月22日 星期四 · 第5天',
          spread: 'home',
        },
        createElement('p', null, 'Plain child without testid'),
      ),
    );

    expect(html).not.toContain('data-testid');
  });

  it('shows 第 3 頁 in the footer for pageNumber 3 in zh-TW and p. 3 in en', async () => {
    await i18n.changeLanguage('zh-TW');
    const zhHtml = renderToStaticMarkup(
      createElement(
        JournalPage,
        { pageNumber: 3, dateLine: '2026年10月22日 星期四 · 第5天' },
        createElement('div', null, 'Charts'),
      ),
    );
    expect(zhHtml).toContain('第 3 頁');
    expect(zhHtml).toContain('手繪旅帳 · 第 3 頁');

    await i18n.changeLanguage('en');
    const enHtml = renderToStaticMarkup(
      createElement(
        JournalPage,
        { pageNumber: 3, dateLine: 'Oct 22, 2026 Thu · Day 5' },
        createElement('div', null, 'Charts'),
      ),
    );
    expect(enHtml).toContain('Travel sketchbook · p. 3');

    await i18n.changeLanguage('zh-TW');
  });

  it("renders spread='home'|'ledger'|'half'|null without error, omits gutter when null, and never clips sticky ancestors", () => {
    expect(SPREAD_GUTTER_CALC.ledger).toBe(
      'calc(1rem + (100% - 2rem - 11 * 1.5rem) * 5 / 12 + 4.5 * 1.5rem)',
    );
    expect(SPREAD_GUTTER_CALC.ledger).toBe(SPREAD_GUTTER_CALC.home);
    for (const spread of ['home', 'ledger', 'half']) {
      const html = renderToStaticMarkup(
        createElement(
          JournalPage,
          { pageNumber: 1, dateLine: '2026年10月22日 星期四', spread },
          createElement('div', null, `Spread ${spread}`),
        ),
      );
      expect(html).toContain('jr-spread-gutter');
      expect(html).toContain(`data-spread="${spread}"`);
      expect(html).toContain(SPREAD_GUTTER_CALC[spread]);
    }

    const nullHtml = renderToStaticMarkup(
      createElement(
        JournalPage,
        { pageNumber: 4, dateLine: '2026年10月22日 星期四', spread: null },
        createElement('div', null, 'Single page'),
      ),
    );
    expect(nullHtml).not.toContain('jr-spread-gutter');
    expect(nullHtml).not.toContain('data-jr-decor="gutter"');

    // Ensure ancestors of children (.jr-desk, .jr-page-sheet, .jr-page-body) do not set overflow-hidden
    const ancestorTags = [
      ...nullHtml.matchAll(/<div\b[^>]*\bclass="[^"]*\b(?:jr-desk|jr-page-sheet|jr-page-body)\b[^"]*"[^>]*>/g),
    ].map((m) => m[0]);
    expect(ancestorTags.length).toBe(3);
    for (const tag of ancestorTags) {
      expect(tag).not.toContain('overflow-hidden');
      expect(tag).not.toContain('overflow-x-hidden');
    }
  });

  it('computes formatPageDateLine with trip day inside trip and omits the day part outside the trip', async () => {
    await i18n.changeLanguage('zh-TW');
    const trip = {
      startDate: '2026-10-18',
      endDate: '2026-10-27',
    };

    expect(formatPageDateLine(i18n.t.bind(i18n), '2026-10-22', trip, 'zh-TW')).toBe(
      '2026年10月22日 星期四 · 第5天',
    );
    expect(formatPageDateLine(null, '2026-10-22', trip, 'zh-TW')).toBe(
      '2026年10月22日 星期四 · 第5天',
    );
    expect(formatPageDateLine(i18n.t.bind(i18n), '2026-10-18', trip, 'zh-TW')).toBe(
      '2026年10月18日 星期日 · 第1天',
    );
    expect(formatPageDateLine(i18n.t.bind(i18n), '2026-10-27', trip, 'zh-TW')).toBe(
      '2026年10月27日 星期二 · 第10天',
    );

    // Outside trip (before startDate, after endDate, or null trip) omits "· 第N天"
    expect(formatPageDateLine(i18n.t.bind(i18n), '2026-10-15', trip, 'zh-TW')).toBe(
      '2026年10月15日 星期四',
    );
    expect(formatPageDateLine(i18n.t.bind(i18n), '2026-10-30', trip, 'zh-TW')).toBe(
      '2026年10月30日 星期五',
    );
    expect(formatPageDateLine(i18n.t.bind(i18n), '2026-10-22', null, 'zh-TW')).toBe(
      '2026年10月22日 星期四',
    );

    // English formatting
    expect(formatPageDateLine(i18n.t.bind(i18n), '2026-10-22', trip, 'en')).toBe(
      'Oct 22, 2026 Thu · Day 5',
    );
    expect(formatPageDateLine(i18n.t.bind(i18n), '2026-10-15', trip, 'en')).toBe(
      'Oct 15, 2026 Thu',
    );
  });

  it('computes 1-based pageNumberForTab in nav order home, ledger, charts, settings with fallback 1', () => {
    expect(pageNumberForTab('home')).toBe(1);
    expect(pageNumberForTab('ledger')).toBe(2);
    expect(pageNumberForTab('charts')).toBe(3);
    expect(pageNumberForTab('settings')).toBe(4);
    expect(pageNumberForTab('day')).toBe(1);
    expect(pageNumberForTab('add')).toBe(1);
    expect(pageNumberForTab(null)).toBe(1);
    expect(pageNumberForTab(undefined)).toBe(1);
  });

  it('contains no raw hex literals in JournalPage.jsx or pageMeta.js', () => {
    for (const filename of ['JournalPage.jsx', 'pageMeta.js']) {
      const filePath = path.join(journalDir, filename);
      const src = fs.readFileSync(filePath, 'utf8');
      expect(HEX_REGEX.test(src), `${filename} should not contain raw hex`).toBe(false);
    }
  });
});

describe('NotebookApp shell + navigation + JournalPage wiring (A4 part b)', () => {
  it('wraps routed screens in JournalPage inside <main> with correct spread, pageNumber, and dateLine', async () => {
    await i18n.changeLanguage('zh-TW');
    const trip = createRefTrip();

    const homeHtml = renderToStaticMarkup(
      createElement(NotebookApp, { trip, today: '2026-10-22', initialHash: '' }),
    );
    expect(homeHtml).toContain('jr-desk min-h-screen text-ink');
    expect(homeHtml).toContain('jr-cover-band sticky top-0');
    expect(homeHtml).toContain('jr-cover-stitch');
    expect(homeHtml).toContain('手繪旅費日誌');
    expect(homeHtml).not.toContain('Travel notebook');
    expect(homeHtml).toContain('2026年10月22日 星期四 · 第5天');
    expect(homeHtml).toContain('手繪旅帳 · 第 1 頁');
    expect(homeHtml).toContain('data-spread="home"');
    expect(homeHtml).toContain('jr-bottom-nav');
    expect(homeHtml).toContain('jr-index-tab-active');
    expect(homeHtml).toContain('jr-desktop-tab-active');

    const ledgerHtml = renderToStaticMarkup(
      createElement(NotebookApp, { trip, today: '2026-10-22', initialHash: '#ledger' }),
    );
    expect(ledgerHtml).toContain('data-spread="ledger"');
    expect(ledgerHtml).toContain('手繪旅帳 · 第 2 頁');

    const chartsHtml = renderToStaticMarkup(
      createElement(NotebookApp, { trip, today: '2026-10-22', initialHash: '#charts' }),
    );
    expect(chartsHtml).toContain('data-spread="half"');
    expect(chartsHtml).toContain('手繪旅帳 · 第 3 頁');

    const dayHtml = renderToStaticMarkup(
      createElement(NotebookApp, { trip, today: '2026-10-22', initialHash: '#day=2026-10-20' }),
    );
    expect(dayHtml).toContain('data-spread="half"');
    expect(dayHtml).toContain('2026年10月20日 星期二 · 第3天');
    expect(dayHtml).not.toContain('2026年10月22日 星期四 · 第5天');
    expect(dayHtml).toContain('手繪旅帳 · 第 1 頁');

    const settingsHtml = renderToStaticMarkup(
      createElement(NotebookApp, { trip, today: '2026-10-22', initialHash: '#settings' }),
    );
    expect(settingsHtml).not.toContain('data-jr-decor="gutter"');
    expect(settingsHtml).toContain('2026年10月22日 星期四 · 第5天');
    expect(settingsHtml).toContain('手繪旅帳 · 第 4 頁');

    const addHtml = renderToStaticMarkup(
      createElement(NotebookApp, { trip, today: '2026-10-22', initialHash: '#add&date=2026-10-20' }),
    );
    expect(addHtml).not.toContain('data-jr-decor="gutter"');
    expect(addHtml).toContain('2026年10月22日 星期四 · 第5天');
    expect(addHtml).toContain('手繪旅帳 · 第 1 頁');
  });

  it('removes unused airmail export from src/proto/ref/parts.jsx', () => {
    expect('airmail' in parts).toBe(false);
  });
});
