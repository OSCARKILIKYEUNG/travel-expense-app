import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EXCHANGE_RATES, PRESET_TRIPS_DATA } from '../utils/constants';
import DataService from './DataService';
import { rebaseRates } from './ExchangeRateService';

function memoryStorage() {
  const bag = new Map();
  return {
    getItem: (k) => (bag.has(k) ? bag.get(k) : null),
    setItem: (k, v) => bag.set(k, String(v)),
    removeItem: (k) => bag.delete(k),
    clear: () => bag.clear(),
    key: (i) => [...bag.keys()][i] ?? null,
    get length() {
      return bag.size;
    },
  };
}

let originalLocalStorage;

beforeEach(() => {
  originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = memoryStorage();
  DataService.setStorageScope('reset-account-test');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-15T01:02:03.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  DataService.setStorageScope(null);
  globalThis.localStorage = originalLocalStorage;
});

const expectedRates = rebaseRates({ ...DEFAULT_EXCHANGE_RATES }, 'HKD');

describe('DataService.resetAccountTrialData', () => {
  it('replaces every trip with one blank JPY/HKD trip and does not resurrect presets', () => {
    DataService.saveSettings({ uiLanguage: 'en', savedAccountingCodes: ['HKD'], savedTripCurrencies: ['JPY'] });
    DataService.saveTripsData({
      currentTripId: 'old',
      trips: [
        {
          id: 'old',
          name: '舊旅程',
          startDate: '2020-01-01',
          endDate: '2020-01-08',
          expenses: [{ id: 'e1', originalAmount: 99, currency: 'JPY' }],
          days: {
            '2020-01-01': {
              title: '日記日',
              note: '註',
              journal: '手記原文',
              sticker: 'fuji',
              itinerary: [{ id: 'i1', time: '09:00', title: '舊行程', done: false }],
            },
          },
          settlements: [{ id: 'stl-1', amount: 10 }],
          settings: { people: ['共同', '人物A', '人物B'], budget: 5000 },
          tripCurrency: 'USD',
          accountingCurrency: 'EUR',
        },
      ],
    });
    DataService.savePeople(['共同', '人物A', '人物B']);
    DataService.saveExpenses([{ id: 'e1', originalAmount: 99 }]);

    expect(DataService.deleteTrip('old')).toBe(false);
    expect(DataService.loadTripsData().trips).toHaveLength(1);
    expect(DataService.loadTripsData().trips[0].name).toBe('舊旅程');

    const data = DataService.resetAccountTrialData({ now: new Date('2026-11-15T01:02:03.000Z') });
    const trip = data.trips[0];
    expect(data.trips).toHaveLength(1);
    expect(data.currentTripId).toBe(trip.id);
    expect(data.updatedAt).toBe('2026-11-15T01:02:03.000Z');
    expect(trip.name).toBe('新旅程');
    expect(trip.startDate).toBeUndefined();
    expect(trip.endDate).toBeUndefined();
    expect(trip.days).toBeUndefined();
    expect(trip.settlements).toBeUndefined();
    expect(trip.expenses).toEqual([]);
    expect(trip.settings).toEqual({ people: ['共同'] });
    expect(trip.tripCurrency).toBe('JPY');
    expect(trip.accountingCurrency).toBe('HKD');
    expect(trip.exchangeRates).toEqual(expectedRates);
    expect(trip.createdAt).toBe('2026-11-15T01:02:03.000Z');
    expect(JSON.stringify(data)).not.toContain('人物A');
    expect(JSON.stringify(data)).not.toContain('手記原文');
    expect(JSON.stringify(data)).not.toContain('我的第一個旅程');
    expect(trip.startDate).not.toBe('2026-11-15');

    const hydrated = DataService.loadTripsData();
    expect(hydrated.trips).toHaveLength(1);
    expect(hydrated.trips[0].name).toBe('新旅程');
    expect(hydrated.trips[0].id).toBe(trip.id);
    expect(hydrated.trips[0].settings.people).toEqual(['共同']);
    expect(DataService.loadPeople()).toEqual(['共同']);
    expect(DataService.loadExpenses()).toEqual([]);
    expect(DataService.loadSettings().uiLanguage).toBe('en');
    expect(DataService.deleteTrip(trip.id)).toBe(false);
    expect(DataService.loadTripsData().trips[0].name).toBe('新旅程');
    expect(PRESET_TRIPS_DATA.trips[0].settings.people).toContain('人物A');
  });

  it('keeps an explicitly saved empty trip list instead of writing preset demo trips', () => {
    DataService.saveTripsData({ trips: [], currentTripId: null });
    const loaded = DataService.loadTripsData();
    expect(loaded.trips).toEqual([]);
    expect(JSON.stringify(loaded)).not.toContain('我的第一個旅程');
    expect(JSON.stringify(loaded)).not.toContain('人物A');
  });

  it('still deletes a non-last trip and still refuses to delete the last one', () => {
    DataService.saveTripsData({
      currentTripId: 'a',
      trips: [
        {
          id: 'a',
          name: 'A',
          expenses: [],
          settings: { people: ['共同'] },
          tripCurrency: 'JPY',
          accountingCurrency: 'HKD',
          exchangeRates: { ...expectedRates },
        },
        {
          id: 'b',
          name: 'B',
          expenses: [],
          settings: { people: ['共同'] },
          tripCurrency: 'JPY',
          accountingCurrency: 'HKD',
          exchangeRates: { ...expectedRates },
        },
      ],
    });
    expect(DataService.deleteTrip('b')).toBe(true);
    expect(DataService.loadTripsData().trips.map((trip) => trip.id)).toEqual(['a']);
    expect(DataService.deleteTrip('a')).toBe(false);
    expect(DataService.loadTripsData().trips).toHaveLength(1);
    const wiped = DataService.resetAccountTrialData();
    expect(wiped.trips).toHaveLength(1);
    expect(wiped.trips[0].name).toBe('新旅程');
    expect(wiped.trips[0].id).not.toBe('a');
  });

  it('creates one empty import trip with 共同 only, even if demo people were saved', () => {
    DataService.saveTripsData({ trips: [], currentTripId: null });
    DataService.savePeople(['共同', '人物A', '人物B']);
    const created = DataService.createEmptyAccountTrip({
      name: '新旅程',
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      now: new Date('2026-11-15T01:02:03.000Z'),
    });
    expect(created.name).toBe('新旅程');
    expect(created.startDate).toBe('2026-11-01');
    expect(created.endDate).toBe('2026-11-03');
    expect(created.expenses).toEqual([]);
    expect(created.days).toBeUndefined();
    expect(created.settlements).toBeUndefined();
    expect(created.settings.people).toEqual(['共同']);
    expect(created.tripCurrency).toBe('JPY');
    expect(created.accountingCurrency).toBe('HKD');
    expect(created.exchangeRates).toEqual(expectedRates);
    const loaded = DataService.loadTripsData();
    expect(loaded.trips).toHaveLength(1);
    expect(loaded.currentTripId).toBe(created.id);
    expect(DataService.loadPeople()).toEqual(['共同']);
    expect(DataService.loadExpenses()).toEqual([]);
    expect(JSON.stringify(loaded)).not.toContain('人物B');
  });
});
