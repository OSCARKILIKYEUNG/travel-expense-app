import { describe, expect, it } from 'vitest';
import i18n from '../i18n.js';
import { formatPageDateLine, pageDateIso } from './pageMeta.js';

describe('pageMeta — pageDateIso & formatPageDateLine (A7d)', () => {
  it('returns the viewed day ISO only when screen === "day" and day is a valid YYYY-MM-DD', () => {
    const today = '2026-10-22';

    expect(pageDateIso({ screen: 'day', day: '2026-10-20', today })).toBe('2026-10-20');
    expect(pageDateIso({ screen: 'day', day: '2026-10-15', today })).toBe('2026-10-15');

    // Invalid day values fall back to today
    expect(pageDateIso({ screen: 'day', day: '', today })).toBe(today);
    expect(pageDateIso({ screen: 'day', day: null, today })).toBe(today);
    expect(pageDateIso({ screen: 'day', day: undefined, today })).toBe(today);
    expect(pageDateIso({ screen: 'day', day: 'not-a-date', today })).toBe(today);
    expect(pageDateIso({ screen: 'day', day: '2026-10-2', today })).toBe(today);
    expect(pageDateIso({ screen: 'day', day: '2026-02-30', today })).toBe(today);
    expect(pageDateIso({ screen: 'day', day: '2026-13-01', today })).toBe(today);

    // Other screens always return today even if day is passed
    for (const screen of ['home', 'ledger', 'charts', 'settings', 'add', null, undefined]) {
      expect(pageDateIso({ screen, day: '2026-10-20', today })).toBe(today);
    }
  });

  it('formats a non-today in-trip date (2026-10-20) with its weekday and day number in zh and en', async () => {
    const trip = {
      startDate: '2026-10-18',
      endDate: '2026-10-27',
    };

    await i18n.changeLanguage('zh-TW');
    expect(
      formatPageDateLine(
        i18n.t.bind(i18n),
        pageDateIso({ screen: 'day', day: '2026-10-20', today: '2026-10-22' }),
        trip,
        'zh-TW',
      ),
    ).toBe('2026年10月20日 星期二 · 第3天');

    // Out-of-trip day omits the day counter part
    expect(
      formatPageDateLine(
        i18n.t.bind(i18n),
        pageDateIso({ screen: 'day', day: '2026-10-15', today: '2026-10-22' }),
        trip,
        'zh-TW',
      ),
    ).toBe('2026年10月15日 星期四');

    await i18n.changeLanguage('en');
    expect(
      formatPageDateLine(
        i18n.t.bind(i18n),
        pageDateIso({ screen: 'day', day: '2026-10-20', today: '2026-10-22' }),
        trip,
        'en',
      ),
    ).toBe('Oct 20, 2026 Tue · Day 3');

    expect(
      formatPageDateLine(
        i18n.t.bind(i18n),
        pageDateIso({ screen: 'day', day: '2026-10-15', today: '2026-10-22' }),
        trip,
        'en',
      ),
    ).toBe('Oct 15, 2026 Thu');

    await i18n.changeLanguage('zh-TW');
  });
});
