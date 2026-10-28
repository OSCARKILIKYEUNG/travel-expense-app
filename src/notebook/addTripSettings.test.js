import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { createRefTrip } from '../proto/ref/mockRefTrip';
import DataService from '../services/DataService';
import NotebookApp, {
  buildMockTrip as buildMockTripFromApp,
  validateNewTrip as validateNewTripFromApp,
} from './NotebookApp';
import SettingsView, {
  applyNotebookCreateTrip,
  buildMockTrip,
  validateNewTrip,
} from './SettingsView';
import { DEFAULT_REF_RATE, adaptTripForNotebook } from './tripRate';

describe('validateNewTrip — new trip input validation and normalization', () => {
  it('re-exports validateNewTrip and buildMockTrip from both SettingsView and NotebookApp', () => {
    expect(validateNewTripFromApp).toBe(validateNewTrip);
    expect(buildMockTripFromApp).toBe(buildMockTrip);
  });

  it('rejects empty, whitespace-only, or missing trip name with errorKey "trip.enterName"', () => {
    expect(validateNewTrip({ name: '', startDate: '2026-10-28' })).toMatchObject({
      ok: false,
      errorKey: 'trip.enterName',
      name: '',
      startDate: '2026-10-28',
    });

    expect(validateNewTrip({ name: '   \t\n  ', startDate: '2026-10-28' })).toMatchObject({
      ok: false,
      errorKey: 'trip.enterName',
      name: '',
    });

    expect(validateNewTrip({}, { today: '2026-10-28' })).toMatchObject({
      ok: false,
      errorKey: 'trip.enterName',
      name: '',
      startDate: '2026-10-28',
      tripCurrency: 'JPY',
    });
  });

  it('normalizes trimmed name, ISO startDate (with today fallback), and uppercase 3-letter currency', () => {
    const res = validateNewTrip(
      {
        name: '  京都賞楓之旅  ',
        startDate: ' 2026-11-15 ',
        tripCurrency: 'krw',
      },
      { today: '2026-10-28' },
    );

    expect(res).toEqual({
      ok: true,
      errorKey: null,
      name: '京都賞楓之旅',
      startDate: '2026-11-15',
      tripCurrency: 'KRW',
      currency: 'KRW',
    });

    const fallbackRes = validateNewTrip(
      {
        name: '台北週末',
        startDate: '',
      },
      { today: '2026-10-28' },
    );

    expect(fallbackRes).toEqual({
      ok: true,
      errorKey: null,
      name: '台北週末',
      startDate: '2026-10-28',
      tripCurrency: 'JPY',
      currency: 'JPY',
    });
  });
});

describe('buildMockTrip — uncontrolled notebook mock trip shape', () => {
  it('builds a mock trip compatible with buildInitialMockTrips and adaptTripForNotebook', () => {
    const mockTrip = buildMockTrip(
      {
        name: '  北海道冬日  ',
        startDate: '2026-12-10',
        tripCurrency: 'jpy',
      },
      { today: '2026-10-28', now: 1761660000000 },
    );

    expect(mockTrip).toEqual({
      id: 'trip-1761660000000',
      name: '北海道冬日',
      startDate: '2026-12-10',
      endDate: '2026-12-10',
      tripCurrency: 'JPY',
      currency: 'JPY',
      accountingCurrency: 'HKD',
      days: {},
      expenses: [],
      settings: {
        people: ['共同'],
        rate: DEFAULT_REF_RATE,
        budget: null,
      },
    });

    const adapted = adaptTripForNotebook(mockTrip, { today: '2026-10-28' });
    expect(adapted.id).toBe('trip-1761660000000');
    expect(adapted.name).toBe('北海道冬日');
    expect(adapted.startDate).toBe('2026-12-10');
    expect(adapted.endDate).toBe('2026-12-10');
    expect(adapted.expenses).toEqual([]);
    expect(adapted.settings).toEqual({
      people: ['共同'],
      rate: DEFAULT_REF_RATE,
      budget: null,
    });
  });
});

describe('applyNotebookCreateTrip & SettingsView rendering', () => {
  it('blocks empty name and invokes onCreateTrip + onToast on valid submission', () => {
    const tZh = i18n.getFixedT('zh-TW');
    const onCreateTrip = vi.fn();
    const onToast = vi.fn();

    const rejected = applyNotebookCreateTrip(
      { name: '   ', startDate: '2026-10-28', tripCurrency: 'JPY' },
      { onCreateTrip, onToast, t: tZh, today: '2026-10-28' },
    );
    expect(rejected.ok).toBe(false);
    expect(rejected.errorKey).toBe('trip.enterName');
    expect(onCreateTrip).not.toHaveBeenCalled();
    expect(onToast).not.toHaveBeenCalled();

    const accepted = applyNotebookCreateTrip(
      { name: '  首爾美食行 ', startDate: '2026-11-02', tripCurrency: 'krw' },
      { onCreateTrip, onToast, t: tZh, today: '2026-10-28' },
    );
    expect(accepted.ok).toBe(true);
    expect(onCreateTrip).toHaveBeenCalledWith({
      name: '首爾美食行',
      startDate: '2026-11-02',
      tripCurrency: 'KRW',
    });
    expect(onToast).toHaveBeenCalledWith('旅程已創建');
  });

  it('persists new trip via DataService.createTrip and makes it the current trip', () => {
    const originalLocalStorage = globalThis.localStorage;
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
    DataService.setStorageScope('test-user-add-trip');
    try {
      DataService.loadTripsData();
      const created = DataService.createTrip('沖繩潛水之旅', '2026-11-20', 'JPY', {});
      const after = DataService.loadTripsData();
      expect(after.currentTripId).toBe(created.id);
      expect(after.trips.some((tr) => tr.id === created.id && tr.name === '沖繩潛水之旅')).toBe(
        true,
      );
    } finally {
      DataService.setStorageScope(null);
      globalThis.localStorage = originalLocalStorage;
    }
  });

  it('renders add-trip-btn in #settings and inline add-trip-form when opened', async () => {
    const trip = createRefTrip();

    await i18n.changeLanguage('zh-TW');
    const zhClosedHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip,
          trips: [trip],
          today: '2026-10-28',
          initialHash: '#settings',
          uiLanguage: 'zh-TW',
        }),
      ),
    );
    expect(zhClosedHtml).toContain('data-testid="add-trip-btn"');
    expect(zhClosedHtml).toContain('+ 新增旅程');
    expect(zhClosedHtml).not.toContain('data-testid="add-trip-form"');

    const zhOpenHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(SettingsView, {
          trip,
          trips: [trip],
          today: '2026-10-28',
          onUpdateTrip() {},
          onSelectTrip() {},
          uiLanguage: 'zh-TW',
          initialShowAddTrip: true,
        }),
      ),
    );
    expect(zhOpenHtml).toContain('data-testid="add-trip-form"');
    expect(zhOpenHtml).toContain('data-testid="new-trip-name"');
    expect(zhOpenHtml).toContain('data-testid="new-trip-start"');
    expect(zhOpenHtml).toContain('value="2026-10-28"');
    expect(zhOpenHtml).toContain('data-testid="new-trip-currency"');
    expect(zhOpenHtml).toContain('data-testid="new-trip-submit"');
    expect(zhOpenHtml).toContain('創建');
    expect(zhOpenHtml).toContain('取消');

    await i18n.changeLanguage('en');
    const enOpenHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(SettingsView, {
          trip,
          trips: [trip],
          today: '2026-10-28',
          onUpdateTrip() {},
          onSelectTrip() {},
          uiLanguage: 'en',
          initialShowAddTrip: true,
        }),
      ),
    );
    expect(enOpenHtml).toContain('data-testid="add-trip-btn"');
    expect(enOpenHtml).toContain('+ New trip');
    expect(enOpenHtml).toContain('data-testid="add-trip-form"');
    expect(enOpenHtml).toContain('Trip name');
    expect(enOpenHtml).toContain('Start date');
    expect(enOpenHtml).toContain('Trip currency');
    expect(enOpenHtml).toContain('Create');
    expect(enOpenHtml).toContain('Cancel');

    await i18n.changeLanguage('zh-TW');
  });
});
