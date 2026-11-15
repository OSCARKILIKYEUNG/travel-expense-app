// @vitest-environment jsdom
/**
 * Included-tax metadata through AddForm, preparePersistedExpense, DataService, and mocked cloud.
 * jsdom does not prove a device sync or a painted receipt.
 */
import { createElement, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { preparePersistedExpense } from '../../notebook/tripRate';
import DataService from '../../services/DataService';
import { buildExpenseFromAI } from '../../services/AIService';
import { persistUserAppData } from '../../services/syncSupabase';
import { AppProvider, useApp } from '../../store/AppContext';
import AddForm from './AddForm';

const USER = 'user-included-tax';
const T0 = '2026-11-15T02:00:00.000Z';
const db = vi.hoisted(() => ({ rows: new Map(), upserts: [] }));

vi.mock('../../lib/supabaseClient', () => {
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
        if (state.table !== 'user_app_data') return { data: null, error: null, count: 0 };
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
        db.upserts.push(structuredClone(payload));
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

function lawsonDraft() {
  const expense = buildExpenseFromAI(
    {
      detected_market: 'JP',
      receipt_type: 'tax_inclusive',
      currency: 'JPY',
      store: '羅森',
      date: '2026年10月22日',
      items: [
        { name: '飯糰', price: 199 },
        { name: '茶', price: 195 },
        { name: '零食', price: 181 },
        { name: '便當', price: 440 },
      ],
      subtotal: 1015,
      tax: 0,
      total_amount: 1015,
      included_tax_amount: 82,
      included_tax_breakdown: [
        { rate_percent: 10, target_amount: 440, basis: 'gross', included_tax_amount: 40 },
        { rate_percent: 8, target_amount: 575, basis: 'gross', included_tax_amount: 42 },
      ],
    },
    0,
    'JPY',
    20,
    'JPY',
  );
  return { ...expense, id: 'scan-included' };
}

function seedTrip() {
  db.rows.set(USER, {
    user_id: USER,
    trips_data: {
      trips: [{
        id: 'trip-1',
        name: 'Tokyo',
        startDate: '2026-10-18',
        endDate: '2026-10-27',
        tripCurrency: 'JPY',
        accountingCurrency: 'HKD',
        exchangeRates: { JPY: 20, HKD: 1 },
        expenses: [],
        settings: { people: ['共同', 'Oscar'] },
      }],
      currentTripId: 'trip-1',
      updatedAt: T0,
    },
    app_settings: { uiLanguage: 'zh-TW' },
    people_list: ['共同', 'Oscar'],
    updated_at: T0,
    subscription_status: 'free',
  });
}

function Harness({ draft, existing, onPrepared }) {
  const { addExpense, updateExpense } = useApp();
  const [open, setOpen] = useState(existing || draft || null);
  if (!open) return null;
  const editing = Boolean(open.createdAt || open.editedAt);
  return createElement(AddForm, {
    initial: editing ? open : undefined,
    defaultDate: '2026-10-22',
    people: ['共同', 'Oscar'],
    scanDraft: editing ? null : open,
    scanState: editing ? null : { status: 'ready', token: open.id, draft: open },
    onCancel: () => setOpen(null),
    onSave: (data) => {
      const prepared = preparePersistedExpense(data, {
        existing: editing ? open : null,
        scanBase: editing ? null : open,
        tripCurrency: 'JPY',
        exchangeRates: { JPY: 20, HKD: 1 },
      });
      onPrepared(prepared);
      if (editing) updateExpense(prepared.record);
      else addExpense(prepared.record);
      setOpen(null);
    },
  });
}

function renderHarness(props) {
  return render(createElement(
    I18nextProvider,
    { i18n },
    createElement(AppProvider, { userId: USER }, createElement(Harness, props)),
  ));
}

beforeEach(async () => {
  localStorage.clear();
  db.rows.clear();
  db.upserts.length = 0;
  DataService.setStorageScope(null);
  await i18n.changeLanguage('zh-TW');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  db.rows.clear();
  DataService.setStorageScope(null);
});

describe('included tax roundtrip', () => {
  it('saves printed metadata, clears it without resurrection, and does not give it to the next receipt', async () => {
    seedTrip();
    const draft = lawsonDraft();
    let prepared = null;
    renderHarness({
      draft,
      onPrepared: (value) => {
        prepared = value;
      },
    });
    fireEvent.click(await screen.findByTestId('form-save'));
    expect(prepared.record.originalAmount).toBe(1015);
    expect(prepared.record.hkdAmount).toBe(1015 / 20);
    expect(prepared.record.tax).toBe(0);
    expect(prepared.record.subtotal).toBe(1015);
    expect(prepared.record.includedTaxAmount).toBe(82);
    expect(prepared.record.includedTaxBreakdown).toEqual([
      { ratePercent: 10, targetAmount: 440, basis: 'gross', includedTaxAmount: 40 },
      { ratePercent: 8, targetAmount: 575, basis: 'gross', includedTaxAmount: 42 },
    ]);

    await persistUserAppData(USER);
    DataService.setStorageScope(USER);
    const saved = DataService.loadExpenses().find((row) => row.store === '羅森');
    const tripSaved = DataService.loadTripsData().trips[0].expenses.find((row) => row.store === '羅森');
    expect(saved.includedTaxAmount).toBe(82);
    expect(tripSaved.includedTaxBreakdown[1].includedTaxAmount).toBe(42);
    expect(JSON.stringify(db.upserts.at(-1).trips_data)).toContain('"includedTaxAmount":82');
    expect(JSON.stringify(db.upserts.at(-1).trips_data)).not.toContain('1097');
    expect(JSON.stringify(saved)).not.toContain('933');

    cleanup();
    renderHarness({
      existing: saved,
      onPrepared: (value) => {
        prepared = value;
      },
    });
    expect((await screen.findByTestId('included-tax-amount')).value).toBe('82');
    fireEvent.click(screen.getByTestId('included-tax-clear-amount'));
    fireEvent.click(screen.getByTestId('included-tax-clear-rows'));
    fireEvent.click(screen.getByTestId('form-save'));
    expect(prepared.record.includedTaxAmount).toBeNull();
    expect(prepared.record.includedTaxBreakdown).toEqual([]);
    expect(prepared.record.originalAmount).toBe(1015);
    expect(prepared.record.tax).toBe(0);

    await waitFor(() => {
      const loaded = DataService.loadExpenses().find((row) => row.store === '羅森');
      expect(loaded.includedTaxAmount).toBeNull();
      expect(loaded.includedTaxBreakdown).toEqual([]);
    });
    await persistUserAppData(USER);
    const cloud = JSON.stringify(db.rows.get(USER).trips_data);
    expect(cloud).toContain('"includedTaxAmount":null');
    expect(cloud).toContain('"includedTaxBreakdown":[]');
    expect(cloud).not.toContain('"includedTaxAmount":82');

    cleanup();
    const reopened = DataService.loadExpenses().find((row) => row.store === '羅森');
    render(createElement(I18nextProvider, { i18n }, createElement(AddForm, {
      initial: reopened,
      people: ['共同'],
      onCancel: () => {},
      onSave: () => {},
    })));
    fireEvent.click(screen.getByTestId('included-tax-toggle'));
    expect(screen.getByTestId('included-tax-amount').value).toBe('');
    expect(screen.getByTestId('included-tax-amount').dataset.mode).toBe('cleared');
    expect(screen.queryByTestId('included-tax-row')).toBeNull();

    cleanup();
    renderHarness({
      draft: {
        id: 'fresh',
        store: '新收據',
        originalAmount: 12,
        currency: 'JPY',
        date: '2026年10月23日',
        category: '飲食',
        items: [{ name: '水', price: 12 }],
      },
      onPrepared: (value) => {
        prepared = value;
      },
    });
    fireEvent.click(await screen.findByTestId('form-save'));
    expect(prepared.record.store).toBe('新收據');
    expect(prepared.record.originalAmount).toBe(12);
    expect(prepared.record.includedTaxAmount).toBeUndefined();
    expect(prepared.record.includedTaxBreakdown).toBeUndefined();
    const fresh = DataService.loadExpenses().find((row) => row.store === '新收據');
    expect(fresh.includedTaxAmount).toBeUndefined();
    expect(fresh.includedTaxBreakdown).toBeUndefined();
  });

  it('keeps explicit null and zero distinct in generic local storage', () => {
    DataService.setStorageScope(USER);
    DataService.saveExpenses([
      { id: 'cleared', originalAmount: 5, tax: 1, includedTaxAmount: null, includedTaxBreakdown: [] },
      { id: 'zero', originalAmount: 5, tax: 1, includedTaxAmount: 0, includedTaxBreakdown: [] },
    ]);
    const loaded = DataService.loadExpenses();
    expect(loaded.find((row) => row.id === 'cleared').includedTaxAmount).toBeNull();
    expect(loaded.find((row) => row.id === 'cleared').includedTaxBreakdown).toEqual([]);
    expect(loaded.find((row) => row.id === 'zero').includedTaxAmount).toBe(0);
    expect(loaded.find((row) => row.id === 'zero').tax).toBe(1);
  });
});
