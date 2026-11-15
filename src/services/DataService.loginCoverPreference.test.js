import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mergeRemoteWithLocalStorage } from '../utils/persistMerge';
import DataService, { KEYS, scopedLocalStorageKey } from './DataService';

function memoryStorage() {
  const bag = new Map();
  return {
    getItem: (key) => (bag.has(key) ? bag.get(key) : null),
    setItem: (key, value) => bag.set(key, String(value)),
    removeItem: (key) => bag.delete(key),
    clear: () => bag.clear(),
    key: (index) => [...bag.keys()][index] ?? null,
    get length() {
      return bag.size;
    },
  };
}

const USER = 'cover-pref-user';
let originalLocalStorage;

beforeEach(() => {
  originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = memoryStorage();
  DataService.setStorageScope(USER);
});

afterEach(() => {
  DataService.setStorageScope(null);
  globalThis.localStorage = originalLocalStorage;
});

function settingsKey() {
  return scopedLocalStorageKey(USER, KEYS.SETTINGS);
}

function readSettings() {
  return JSON.parse(globalThis.localStorage.getItem(settingsKey()));
}

describe('DataService loginCoverId', () => {
  it('does not import cover images', () => {
    const source = readFileSync(path.resolve('src/services/DataService.js'), 'utf8');
    expect(source).toContain('normalizeLoginCoverId');
    expect(source).not.toMatch(/login-covers|webp|loginCovers/);
  });

  it('round-trips an allowlisted id and leaves language, lists, and expenses alone', () => {
    DataService.saveExpenses([{ id: 'keep-me', originalAmount: 12 }]);
    DataService.saveSettings({
      uiLanguage: 'en',
      homeCurrency: 'HKD',
      loginCoverId: ' OSAKA ',
      savedAccountingCodes: ['HKD', 'JPY'],
      savedTripCurrencies: ['JPY'],
      customExpenseCategories: ['茶'],
      readerNote: 'keep-me',
    });

    const loaded = DataService.loadSettings();
    expect(loaded.loginCoverId).toBe('osaka');
    expect(loaded.uiLanguage).toBe('en');
    expect(loaded.savedAccountingCodes).toEqual(['HKD', 'JPY']);
    expect(loaded.savedTripCurrencies).toEqual(['JPY']);
    expect(loaded.customExpenseCategories).toEqual(['茶']);
    expect(DataService.loadExpenses()).toEqual([{ id: 'keep-me', originalAmount: 12 }]);

    const raw = readSettings();
    expect(raw.loginCoverId).toBe('osaka');
    expect(raw.readerNote).toBe('keep-me');
    expect(JSON.stringify(raw)).not.toMatch(/webp|data:image|https?:\/\//i);
    expect(DataService.loadExpenses()).toEqual([{ id: 'keep-me', originalAmount: 12 }]);
  });

  it('normalizes a missing or unknown stored id to tokyo without dropping other settings', () => {
    globalThis.localStorage.setItem(settingsKey(), JSON.stringify({
      uiLanguage: 'en',
      homeCurrency: 'HKD',
      loginCoverId: 'kamakura',
      savedAccountingCodes: ['USD'],
      savedTripCurrencies: ['EUR'],
      customExpenseCategories: ['茶'],
      readerNote: 'keep-me',
    }));

    const loaded = DataService.loadSettings();
    expect(loaded.loginCoverId).toBe('tokyo');
    expect(loaded.uiLanguage).toBe('en');
    expect(loaded.savedAccountingCodes).toEqual(['USD']);
    expect(loaded.savedTripCurrencies).toEqual(['EUR']);
    expect(loaded.customExpenseCategories).toEqual(['茶']);
    expect(readSettings().loginCoverId).toBe('tokyo');
    expect(readSettings().readerNote).toBe('keep-me');
  });

  it('refuses to persist a url or image payload in loginCoverId', () => {
    DataService.saveSettings({
      uiLanguage: 'zh-TW',
      loginCoverId: 'https://cdn.example/private.webp',
      loginCoverSrc: 'data:image/webp;base64,AAAA',
    });
    expect(readSettings().loginCoverId).toBe('tokyo');
    const loaded = DataService.loadSettings();
    expect(loaded.loginCoverId).toBe('tokyo');
    expect(loaded).not.toHaveProperty('loginCoverSrc');
    expect(JSON.stringify(loaded)).not.toMatch(/webp|data:image|https?:/);
    expect(JSON.stringify(readSettings())).not.toMatch(/data:image|https?:/);
  });

  it('hydrates loginCoverId when a newer remote trip row wins, and keeps the local id when local trips are newer', () => {
    const tripsKey = scopedLocalStorageKey(USER, KEYS.TRIPS);
    const older = '2026-11-01T00:00:00.000Z';
    const newer = '2026-11-02T00:00:00.000Z';
    globalThis.localStorage.setItem(tripsKey, JSON.stringify({
      currentTripId: 't',
      updatedAt: older,
      trips: [{ id: 't', expenses: [{ id: 'e1' }] }],
    }));
    globalThis.localStorage.setItem(settingsKey(), JSON.stringify({
      uiLanguage: 'en',
      loginCoverId: 'osaka',
      savedAccountingCodes: ['HKD'],
      savedTripCurrencies: ['JPY'],
      customExpenseCategories: ['茶'],
    }));

    const remoteWin = mergeRemoteWithLocalStorage(globalThis.localStorage, USER, {
      trips_data: {
        currentTripId: 't',
        updatedAt: newer,
        trips: [{ id: 't', expenses: [{ id: 'e1' }, { id: 'e2' }] }],
      },
      updated_at: newer,
      app_settings: {
        uiLanguage: 'zh-TW',
        loginCoverId: 'kyushu',
        savedAccountingCodes: ['HKD', 'USD'],
        savedTripCurrencies: ['JPY'],
        customExpenseCategories: ['點心'],
      },
      people_list: ['共同'],
    }, Date.parse('2026-11-03T00:00:00.000Z'));

    expect(remoteWin.source).toBe('remote');
    const hydrated = DataService.loadSettings();
    expect(hydrated.loginCoverId).toBe('kyushu');
    expect(hydrated.uiLanguage).toBe('zh-TW');
    expect(hydrated.savedAccountingCodes).toEqual(['HKD', 'USD']);
    expect(hydrated.customExpenseCategories).toEqual(['點心']);
    expect(JSON.stringify(hydrated)).not.toMatch(/webp|data:image/);

    globalThis.localStorage.setItem(tripsKey, JSON.stringify({
      currentTripId: 't',
      updatedAt: '2026-11-04T00:00:00.000Z',
      trips: [{ id: 't', expenses: [{ id: 'local-exp' }] }],
    }));
    globalThis.localStorage.setItem(settingsKey(), JSON.stringify({
      uiLanguage: 'en',
      loginCoverId: 'osaka',
      savedAccountingCodes: ['HKD'],
      savedTripCurrencies: ['JPY'],
      customExpenseCategories: [],
    }));
    const localWin = mergeRemoteWithLocalStorage(globalThis.localStorage, USER, {
      trips_data: {
        currentTripId: 't',
        updatedAt: newer,
        trips: [{ id: 't', expenses: [{ id: 'remote-exp' }] }],
      },
      updated_at: newer,
      app_settings: { uiLanguage: 'zh-TW', loginCoverId: 'kyushu' },
    }, Date.parse('2026-11-05T00:00:00.000Z'));
    expect(localWin.source).toBe('local');
    expect(DataService.loadSettings().loginCoverId).toBe('osaka');
    expect(readSettings().loginCoverId).toBe('osaka');
  });
});
