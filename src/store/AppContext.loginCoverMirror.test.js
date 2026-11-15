// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveMountedLoginCover } from '../components/auth/loginCovers';
import i18n from '../i18n';
import DataService from '../services/DataService';
import {
  DEVICE_LOGIN_COVER_KEY,
  LOGIN_COVER_IDS,
  writeDeviceLoginCoverId,
} from '../utils/loginCoverPreference';
import { AppProvider, useApp } from './AppContext';

const USER = 'user-cover-mirror';
const T0 = '2026-11-15T09:00:00.000Z';
const REJECTED_COVER_PAYLOAD = 'https://cdn.example/private.webp?user=account-42';

const db = vi.hoisted(() => ({ rows: new Map() }));

vi.mock('../lib/supabaseClient', () => {
  function from(table) {
    const state = { table, columns: '*' };
    const api = {
      select(columns) {
        state.columns = columns;
        return api;
      },
      eq() {
        return api;
      },
      async maybeSingle() {
        if (state.table !== 'user_app_data') {
          return { data: null, error: null, count: 0 };
        }
        const row = db.rows.get(USER);
        if (!row) return { data: null, error: null };
        if (state.columns && state.columns !== '*') {
          return {
            data: {
              updated_at: row.updated_at,
              trips_data_updated_at: row.trips_data?.updatedAt ?? null,
              subscription_status: row.subscription_status ?? null,
            },
            error: null,
          };
        }
        return { data: structuredClone(row), error: null };
      },
      async upsert(payload) {
        const prev = db.rows.get(payload.user_id) || {};
        db.rows.set(payload.user_id, { ...prev, ...structuredClone(payload) });
        return { error: null };
      },
      then(onFulfilled, onRejected) {
        return Promise.resolve({ data: null, error: null, count: 0 }).then(onFulfilled, onRejected);
      },
    };
    return api;
  }
  return { supabase: { from } };
});

function seedRemote(loginCoverId) {
  db.rows.set(USER, {
    user_id: USER,
    trips_data: {
      trips: [{
        id: 'trip-1',
        name: 'Tokyo',
        expenses: [{ id: 'base', amount: 100 }],
        settings: { people: ['共同'] },
      }],
      currentTripId: 'trip-1',
      updatedAt: T0,
    },
    app_settings: {
      uiLanguage: 'zh-TW',
      loginCoverId,
      savedAccountingCodes: ['HKD'],
      savedTripCurrencies: ['JPY'],
      customExpenseCategories: [],
    },
    people_list: ['共同'],
    updated_at: T0,
    subscription_status: 'free',
  });
}

function CoverProbe() {
  const { settings, updateSettings } = useApp();
  return createElement(
    'div',
    null,
    createElement('span', { 'data-testid': 'hydrated-cover' }, settings.loginCoverId),
    createElement('button', {
      type: 'button',
      'data-testid': 'cover-set-osaka',
      onClick: () => updateSettings({ loginCoverId: 'osaka' }),
    }, 'osaka'),
    createElement('button', {
      type: 'button',
      'data-testid': 'cover-set-payload',
      onClick: () => updateSettings({ loginCoverId: REJECTED_COVER_PAYLOAD }),
    }, 'payload'),
  );
}

function renderAuthenticated() {
  return render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(AppProvider, { userId: USER }, createElement(CoverProbe)),
    ),
  );
}

function storedValues() {
  const values = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    values.push(localStorage.getItem(key));
  }
  return values;
}

function expectDeviceEnum(id) {
  const raw = localStorage.getItem(DEVICE_LOGIN_COVER_KEY);
  expect(LOGIN_COVER_IDS).toContain(id);
  expect(raw).toBe(id);
  expect(storedValues().join('\n')).not.toContain(REJECTED_COVER_PAYLOAD);
  const signedOut = resolveMountedLoginCover();
  expect(signedOut.id).toBe(id);
  expect(signedOut.src).toContain(`default-${id}`);
}

describe('AppContext authenticated login-cover mirror', () => {
  beforeEach(() => {
    localStorage.clear();
    db.rows.clear();
    DataService.setStorageScope(null);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    db.rows.clear();
    DataService.setStorageScope(null);
  });

  it('writes the hydrated enum after bootstrap and again after updateSettings, and the signed-out resolver reads that enum', async () => {
    writeDeviceLoginCoverId('osaka');
    expect(localStorage.getItem(DEVICE_LOGIN_COVER_KEY)).toBe('osaka');
    seedRemote(' KYOTO ');

    renderAuthenticated();

    await waitFor(() => {
      expect(screen.getByTestId('hydrated-cover').textContent).toBe('kyoto');
      expect(localStorage.getItem(DEVICE_LOGIN_COVER_KEY)).toBe('kyoto');
    });
    expectDeviceEnum('kyoto');
    expect(JSON.parse(localStorage.getItem(`user:${USER}:travel_app_settings`)).loginCoverId).toBe('kyoto');

    fireEvent.click(screen.getByTestId('cover-set-osaka'));
    await waitFor(() => {
      expect(screen.getByTestId('hydrated-cover').textContent).toBe('osaka');
      expect(localStorage.getItem(DEVICE_LOGIN_COVER_KEY)).toBe('osaka');
    });
    expectDeviceEnum('osaka');

    fireEvent.click(screen.getByTestId('cover-set-payload'));
    await waitFor(() => {
      expect(localStorage.getItem(DEVICE_LOGIN_COVER_KEY)).toBe('tokyo');
    });
    expectDeviceEnum('tokyo');
    DataService.setStorageScope(USER);
    expect(DataService.loadSettings().loginCoverId).toBe('tokyo');

    cleanup();
    expect(localStorage.getItem(DEVICE_LOGIN_COVER_KEY)).toBe('tokyo');
    expect(resolveMountedLoginCover().id).toBe('tokyo');
  });
});
