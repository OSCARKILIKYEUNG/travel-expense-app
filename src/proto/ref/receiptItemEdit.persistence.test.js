// @vitest-environment jsdom
/**
 * AddForm -> preparePersistedExpense -> AppContext -> DataService -> trips_data.
 * Supabase is mocked. jsdom does not prove a device sync or a painted receipt.
 */
import { createElement, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import NotebookApp from '../../notebook/NotebookApp';
import { preparePersistedExpense } from '../../notebook/tripRate';
import DataService from '../../services/DataService';
import { persistUserAppData } from '../../services/syncSupabase';
import { AppProvider, useApp } from '../../store/AppContext';
import AddForm from './AddForm';
import ExpenseCard from './ExpenseCard';
import RefProto from './index';

const USER = 'user-receipt-edit';
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

function seedTrip(expenses = []) {
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
        exchangeRates: { JPY: 20, HKD: 1, EUR: 8 },
        expenses,
        settings: { people: ['共同', 'Oscar'] },
      }],
      currentTripId: 'trip-1',
      updatedAt: T0,
    },
    app_settings: { uiLanguage: 'zh-TW', loginCoverId: 'tokyo' },
    people_list: ['共同', 'Oscar'],
    updated_at: T0,
    subscription_status: 'free',
  });
}

function scanDraft(items, id = 'scan-persist') {
  return {
    id,
    store: 'Persist Lawson',
    originalAmount: 500,
    currency: 'EUR',
    originalCurrency: 'EUR',
    category: '飲食',
    date: '2026-10-22',
    tax: 12,
    discount: 3,
    taxRefund: 1,
    subtotal: 490,
    sourceHash: 'hash-persist',
    receiptType: 'standard',
    aiDetectedMarket: 'EU',
    items,
  };
}

function ScanHarness({ draft, onPrepared }) {
  const { addExpense } = useApp();
  return createElement(AddForm, {
    defaultDate: '2026-10-22',
    people: ['共同', 'Oscar'],
    onCancel: () => {},
    scanDraft: draft,
    scanState: { status: 'ready', token: draft.id, draft },
    onSave: (data) => {
      const prepared = preparePersistedExpense(data, {
        scanBase: draft,
        tripCurrency: 'JPY',
        exchangeRates: { JPY: 20, HKD: 1, EUR: 8 },
      });
      onPrepared(prepared);
      addExpense(prepared.record);
    },
  });
}

function renderHarness(draft, onPrepared) {
  return render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(AppProvider, { userId: USER }, createElement(ScanHarness, { draft, onPrepared })),
    ),
  );
}

function openItems() {
  const toggle = screen.getByTestId('receipt-items-toggle');
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle);
}

async function waitForItem(name) {
  await waitFor(() => {
    const sent = db.upserts.find((row) => JSON.stringify(row.trips_data || {}).includes(name));
    expect(sent).toBeTruthy();
  }, { timeout: 4000 });
}

beforeEach(async () => {
  localStorage.clear();
  db.rows.clear();
  db.upserts.length = 0;
  DataService.setStorageScope(null);
  await i18n.changeLanguage('zh-TW');
});

afterEach(async () => {
  cleanup();
  localStorage.clear();
  db.rows.clear();
  DataService.setStorageScope(null);
  window.location.hash = '';
  await i18n.changeLanguage('zh-TW');
});

describe('receipt line save reaches trips_data', () => {
  it('saves an edited scan through the store and reopens the same lines', async () => {
    const tea = {
      name: '茶',
      name_en: 'Tea',
      nameEn: 'TeaEn',
      original_name: 'お茶',
      originalName: 'お茶名',
      price: 220,
      price_actual: 200,
      qty: 2,
      currency: 'EUR',
      assignedTo: 'Oscar',
      sku: 'T-1',
    };
    const sibling = { name: '留', price: 'nope', mystery: { n: 1 } };
    const draft = scanDraft([tea, sibling]);
    seedTrip();
    let prepared = null;
    renderHarness(draft, (value) => {
      prepared = value;
    });
    await screen.findByTestId('expense-form');
    openItems();
    fireEvent.change(screen.getByDisplayValue('茶'), { target: { value: '焙茶' } });
    fireEvent.change(screen.getAllByTestId('receipt-item-price-input')[0], { target: { value: '-5' } });
    fireEvent.click(screen.getByTestId('form-save'));

    expect(prepared.record.originalAmount).toBe(500);
    expect(prepared.record.tax).toBe(12);
    expect(prepared.record.discount).toBe(3);
    expect(prepared.record.taxRefund).toBe(1);
    expect(prepared.record.subtotal).toBe(490);
    expect(prepared.record.rate).toBe(8);
    expect(prepared.record.hkdAmount).toBe(62.5);
    expect(prepared.record.sourceHash).toBe('hash-persist');
    expect(prepared.record.currency).toBe('EUR');
    expect(prepared.record.items[0].name).toBe('焙茶');
    expect(prepared.record.items[0].price).toBe(-5);
    expect(prepared.record.items[0].price_actual).toBe(200);
    expect(prepared.record.items[0].name_en).toBeUndefined();
    expect(prepared.record.items[0].original_name).toBe('お茶');
    expect(prepared.record.items[1]).toBe(sibling);
    expect(tea.name).toBe('茶');
    expect(JSON.stringify(prepared.record.items)).not.toContain('dirty');

    await waitForItem('焙茶');
    await persistUserAppData(USER);
    DataService.setStorageScope(USER);
    const loaded = DataService.loadExpenses().find((expense) => expense.store === 'Persist Lawson');
    const tripExpense = DataService.loadTripsData().trips[0].expenses.find((expense) => expense.store === 'Persist Lawson');
    expect(loaded.items[0]).toMatchObject({ name: '焙茶', price: -5, price_actual: 200, sku: 'T-1', currency: 'EUR' });
    expect(loaded.items[0].nameEn).toBeUndefined();
    expect(loaded.items[1]).toMatchObject({ name: '留', price: 'nope' });
    expect(tripExpense.items).toEqual(loaded.items);
    expect(loaded.originalAmount).toBe(500);
    expect(loaded.tax).toBe(12);
    expect(loaded.discount).toBe(3);
    expect(loaded.taxRefund).toBe(1);

    cleanup();
    render(createElement(I18nextProvider, { i18n }, createElement(ExpenseCard, {
      expense: loaded,
      onEdit: () => {},
      onDelete: () => {},
    })));
    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    const savedRow = screen.getAllByTestId('receipt-item-row')[0];
    expect(savedRow.textContent).toContain('焙茶');
    expect(savedRow.textContent).not.toContain('Tea');
    expect(savedRow.textContent).toContain('EUR -5');
    expect(savedRow.textContent).toContain('EUR 200');
    expect(savedRow.textContent).not.toContain('-10');

    cleanup();
    await i18n.changeLanguage('en');
    render(createElement(I18nextProvider, { i18n }, createElement(ExpenseCard, {
      expense: loaded,
      onEdit: () => {},
      onDelete: () => {},
    })));
    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    expect(screen.getAllByTestId('receipt-item-row')[0].textContent).toContain('焙茶');
    expect(screen.getAllByTestId('receipt-item-row')[0].textContent).not.toContain('Tea');

    cleanup();
    await i18n.changeLanguage('zh-TW');
    render(createElement(I18nextProvider, { i18n }, createElement(AddForm, {
      initial: loaded,
      people: ['共同', 'Oscar'],
      onCancel: () => {},
      onSave: () => {},
    })));
    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    expect(screen.getByDisplayValue('焙茶')).toBeTruthy();
    expect(screen.getAllByTestId('receipt-item-price-input')[0].value).toBe('-5');
    expect(screen.getAllByTestId('receipt-item-actual-input')[0].value).toBe('200');
  });

  it('persists an explicit empty item list and does not resurrect the scan lines', async () => {
    const tea = { name: '茶', price: 220, name_en: 'Tea' };
    const draft = scanDraft([tea], 'scan-empty');
    seedTrip();
    let prepared = null;
    renderHarness(draft, (value) => {
      prepared = value;
    });
    await screen.findByTestId('expense-form');
    openItems();
    fireEvent.click(screen.getByTestId('receipt-item-remove'));
    fireEvent.click(screen.getByTestId('form-save'));
    expect(prepared.record.items).toEqual([]);
    expect(tea.name).toBe('茶');
    await waitFor(() => {
      const sent = db.upserts.at(-1);
      const expenses = sent?.trips_data?.trips?.[0]?.expenses || [];
      const saved = expenses.find((expense) => expense.store === 'Persist Lawson');
      expect(saved?.items).toEqual([]);
    }, { timeout: 4000 });
    DataService.setStorageScope(USER);
    const loaded = DataService.loadTripsData().trips[0].expenses.find((expense) => expense.store === 'Persist Lawson');
    expect(loaded.items).toEqual([]);
    cleanup();
    render(createElement(I18nextProvider, { i18n }, createElement(ExpenseCard, {
      expense: loaded,
      onEdit: () => {},
      onDelete: () => {},
    })));
    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    expect(screen.getByTestId('receipt-items-empty').textContent).toContain('未辨識到明細');
    expect(screen.queryByText('茶')).toBeNull();
  });

  it('omits untouched items from the form and keeps the scan payload exact', async () => {
    const tea = { name: '茶', price: 220, name_en: 'Tea', price_actual: 200 };
    const draft = scanDraft([tea], 'scan-omit');
    seedTrip();
    let prepared = null;
    renderHarness(draft, (value) => {
      prepared = value;
    });
    await screen.findByTestId('expense-form');
    fireEvent.click(screen.getByTestId('form-save'));
    expect(prepared.record.items).toBe(draft.items);
    expect(prepared.record.tax).toBe(12);
    expect(prepared.record.discount).toBe(3);
    expect(prepared.record.originalAmount).toBe(500);
    await waitForItem('茶');
    const sent = [...db.upserts].reverse().find((row) => JSON.stringify(row.trips_data || {}).includes('Tea'));
    const cloudItems = sent.trips_data.trips[0].expenses.find((expense) => expense.store === 'Persist Lawson').items;
    expect(cloudItems).toEqual([tea]);
  });
});

function SavedEditHarness({ expenseId, onPrepared, live }) {
  const { expenses, updateExpense } = useApp();
  const [open, setOpen] = useState(true);
  const [session, setSession] = useState(0);
  const current = expenses.find((row) => row.id === expenseId) || null;
  if (live && current?.items?.[0] && !live.item) live.item = current.items[0];
  return createElement(
    'div',
    null,
    createElement('button', {
      type: 'button',
      'data-testid': 'reopen-saved-edit',
      onClick: () => {
        setSession((n) => n + 1);
        setOpen(true);
      },
    }, 'reopen'),
    open && current
      ? createElement(AddForm, {
        key: `saved-${session}`,
        initial: current,
        people: ['共同', 'Oscar'],
        onCancel: () => setOpen(false),
        onSave: (data) => {
          const prepared = preparePersistedExpense(data, {
            existing: current,
            tripCurrency: 'JPY',
            exchangeRates: { JPY: 20, HKD: 1, EUR: 8 },
          });
          onPrepared(prepared);
          updateExpense(prepared.record);
          setOpen(false);
        },
      })
      : null,
  );
}

describe('saved receipt edit uses updateExpense', () => {
  it('keeps Cancel local, then persists explicit items without touching total, tax, or rates', async () => {
    const tea = Object.freeze({
      name: '茶',
      name_en: 'Tea',
      nameEn: 'TeaEn',
      original_name: 'お茶',
      originalName: 'お茶名',
      price: 220,
      price_actual: 200,
      qty: 2,
      currency: 'EUR',
      assignedTo: 'Oscar',
      sku: 'T-1',
    });
    const saved = {
      id: 'exp-saved',
      store: 'Saved Lawson',
      originalAmount: 500,
      hkdAmount: 62.5,
      currency: 'EUR',
      originalCurrency: 'EUR',
      rate: 8,
      category: '飲食',
      date: '2026-10-22',
      tax: 12,
      discount: 3,
      taxRefund: 1,
      subtotal: 490,
      sourceHash: 'hash-saved',
      receiptType: 'standard',
      aiDetectedMarket: 'EU',
      scanned: true,
      payer: 'Oscar',
      payment: 'cash',
      paymentMethod: 'cash',
      assignedTo: '共同',
      items: [tea],
    };
    seedTrip([saved]);
    const prepared = [];
    const live = {};
    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(
          AppProvider,
          { userId: USER },
          createElement(SavedEditHarness, {
            expenseId: 'exp-saved',
            live,
            onPrepared: (value) => prepared.push(value),
          }),
        ),
      ),
    );
    await screen.findByTestId('expense-form');
    const readSaved = () => DataService.loadTripsData().trips[0].expenses.find((row) => row.id === 'exp-saved');
    const before = structuredClone(readSaved());
    const rates = { ...DataService.loadTripsData().trips[0].exchangeRates };

    openItems();
    fireEvent.change(screen.getByTestId('receipt-item-name'), { target: { value: '取消名' } });
    fireEvent.change(screen.getByTestId('receipt-item-price-input'), { target: { value: '-4' } });
    fireEvent.click(screen.getByTestId('form-cancel'));
    expect(screen.queryByTestId('expense-form')).toBeNull();
    expect(prepared).toHaveLength(0);
    expect(live.item.name).toBe('茶');
    expect(live.item.price).toBe(220);
    expect(live.item.qty).toBe(2);
    expect(live.item.name_en).toBe('Tea');
    expect(readSaved()).toEqual(before);
    expect(readSaved().originalAmount).toBe(500);
    expect(readSaved().tax).toBe(12);
    expect(readSaved().discount).toBe(3);
    expect(readSaved().taxRefund).toBe(1);
    expect(readSaved().subtotal).toBe(490);
    expect(readSaved().rate).toBe(8);
    expect(readSaved().hkdAmount).toBe(62.5);
    expect(readSaved().sourceHash).toBe('hash-saved');
    expect(tea.name).toBe('茶');
    expect(tea.price).toBe(220);

    await waitFor(() => {
      expect(db.upserts.length).toBeGreaterThan(0);
    }, { timeout: 4000 });
    expect(JSON.stringify(db.upserts)).not.toContain('取消名');
    expect(JSON.stringify(db.rows.get(USER))).not.toContain('取消名');
    expect(DataService.loadTripsData().trips[0].exchangeRates).toEqual(rates);

    fireEvent.click(screen.getByTestId('reopen-saved-edit'));
    await screen.findByTestId('expense-form');
    openItems();
    expect(screen.getByDisplayValue('茶')).toBeTruthy();
    fireEvent.change(screen.getByTestId('receipt-item-name'), { target: { value: '焙茶' } });
    fireEvent.click(screen.getByTestId('form-save'));
    expect(prepared).toHaveLength(1);
    expect(prepared[0].record.items[0]).toMatchObject({
      name: '焙茶',
      original_name: 'お茶',
      originalName: 'お茶名',
      price: 220,
      price_actual: 200,
      qty: 2,
      currency: 'EUR',
      assignedTo: 'Oscar',
      sku: 'T-1',
    });
    expect(prepared[0].record.items[0].name_en).toBeUndefined();
    expect(prepared[0].record.items[0].nameEn).toBeUndefined();
    expect(prepared[0].record.originalAmount).toBe(500);
    expect(prepared[0].record.tax).toBe(12);
    expect(prepared[0].record.discount).toBe(3);
    expect(prepared[0].record.taxRefund).toBe(1);
    expect(prepared[0].record.subtotal).toBe(490);
    expect(prepared[0].record.rate).toBe(8);
    expect(prepared[0].record.hkdAmount).toBe(62.5);
    expect(prepared[0].record.sourceHash).toBe('hash-saved');
    expect(prepared[0].record.receiptType).toBe('standard');
    expect(prepared[0].record.aiDetectedMarket).toBe('EU');
    expect(prepared[0].record.currency).toBe('EUR');
    expect(JSON.stringify(prepared[0].record.items)).not.toContain('dirty');
    expect(tea.name).toBe('茶');

    await waitForItem('焙茶');
    await persistUserAppData(USER);
    const edited = readSaved();
    expect(edited.items[0]).toMatchObject({ name: '焙茶', price: 220, qty: 2, sku: 'T-1', price_actual: 200 });
    expect(edited.items[0].name_en).toBeUndefined();
    expect(edited.originalAmount).toBe(500);
    expect(edited.tax).toBe(12);
    expect(edited.rate).toBe(8);
    expect(edited.hkdAmount).toBe(62.5);
    expect(edited.sourceHash).toBe('hash-saved');
    const cloudEdited = db.rows.get(USER).trips_data.trips[0].expenses.find((row) => row.id === 'exp-saved');
    expect(cloudEdited.items).toEqual(edited.items);
    expect(cloudEdited.tax).toBe(12);
    expect(cloudEdited.originalAmount).toBe(500);
    expect(DataService.loadExpenses().find((row) => row.id === 'exp-saved').items[0].name).toBe('焙茶');

    fireEvent.click(screen.getByTestId('reopen-saved-edit'));
    await screen.findByTestId('expense-form');
    openItems();
    expect(screen.getByDisplayValue('焙茶')).toBeTruthy();
    fireEvent.click(screen.getByTestId('receipt-item-remove'));
    fireEvent.click(screen.getByTestId('form-save'));
    expect(prepared).toHaveLength(2);
    expect(prepared[1].record.items).toEqual([]);
    expect(prepared[1].record.originalAmount).toBe(500);
    expect(prepared[1].record.tax).toBe(12);
    expect(prepared[1].record.discount).toBe(3);
    expect(prepared[1].record.taxRefund).toBe(1);
    expect(prepared[1].record.subtotal).toBe(490);
    expect(prepared[1].record.rate).toBe(8);
    expect(prepared[1].record.hkdAmount).toBe(62.5);
    expect(prepared[1].record.sourceHash).toBe('hash-saved');
    expect(prepared[1].record.receiptType).toBe('standard');
    expect(prepared[1].record.aiDetectedMarket).toBe('EU');

    await waitFor(() => {
      const sent = db.upserts.at(-1);
      const row = sent?.trips_data?.trips?.[0]?.expenses?.find((expense) => expense.id === 'exp-saved');
      expect(row?.items).toEqual([]);
      expect(row?.tax).toBe(12);
      expect(row?.originalAmount).toBe(500);
      expect(row?.rate).toBe(8);
    }, { timeout: 4000 });
    await persistUserAppData(USER);
    const cleared = readSaved();
    expect(cleared.items).toEqual([]);
    expect(cleared.originalAmount).toBe(500);
    expect(cleared.tax).toBe(12);
    expect(cleared.discount).toBe(3);
    expect(cleared.taxRefund).toBe(1);
    expect(cleared.subtotal).toBe(490);
    expect(cleared.rate).toBe(8);
    expect(cleared.hkdAmount).toBe(62.5);
    expect(cleared.currency).toBe('EUR');
    expect(cleared.originalCurrency).toBe('EUR');
    expect(cleared.sourceHash).toBe('hash-saved');
    expect(cleared.receiptType).toBe('standard');
    expect(cleared.aiDetectedMarket).toBe('EU');
    expect(DataService.loadTripsData().trips[0].exchangeRates).toEqual({ JPY: 20, HKD: 1, EUR: 8 });
    expect(tea.name).toBe('茶');
    expect(tea.price).toBe(220);
    expect(tea.qty).toBe(2);
  });
});

describe('notebook and ref saves keep explicit items', () => {
  it('keeps a removed scan list empty in NotebookApp and an edited saved name', () => {
    const draft = scanDraft([{ name: '掃描茶', price: 20, name_en: 'Scan tea' }], 'nb-scan');
    const trip = {
      id: 'trip-nb',
      name: 'Notebook',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      tripCurrency: 'JPY',
      accountingCurrency: 'HKD',
      exchangeRates: { JPY: 20, HKD: 1, EUR: 8 },
      settings: { people: ['共同', 'Oscar'], rate: 0.05 },
      expenses: [],
    };
    const scanner = {
      scanDraft: draft,
      scanState: { status: 'ready', message: 'ready', draft, token: draft.id },
      requestScan: () => false,
      clearScan: () => {},
    };
    const view = render(createElement(I18nextProvider, { i18n }, createElement(NotebookApp, {
      trip,
      trips: [trip],
      today: '2026-10-22',
      initialHash: '#add&date=2026-10-22',
      scanner,
    })));
    openItems();
    fireEvent.click(screen.getByTestId('receipt-item-remove'));
    fireEvent.click(screen.getByTestId('form-save'));
    const card = screen.getByRole('heading', { name: 'Persist Lawson' }).closest('article').parentElement;
    fireEvent.click(within(card).getByTestId('receipt-items-toggle'));
    expect(within(card).getByTestId('receipt-items-empty').textContent).toContain('未辨識');
    expect(within(card).queryByText('掃描茶')).toBeNull();
    view.unmount();
    window.location.hash = '';

    const existing = {
      id: 'exp-1',
      store: 'Old Shop',
      originalAmount: 40,
      currency: 'JPY',
      category: '飲食',
      date: '2026-10-22',
      scanned: true,
      payer: 'Oscar',
      payment: 'cash',
      assignedTo: '共同',
      hkdAmount: 2,
      items: [{ name: '舊名', price: 40, name_en: 'Old', original_name: 'ふるい' }],
    };
    render(createElement(I18nextProvider, { i18n }, createElement(NotebookApp, {
      trip: { ...trip, expenses: [existing] },
      trips: [{ ...trip, expenses: [existing] }],
      today: '2026-10-22',
      initialHash: '#add&date=2026-10-22&edit=exp-1',
    })));
    openItems();
    fireEvent.change(screen.getByTestId('receipt-item-name'), { target: { value: '新名' } });
    fireEvent.click(screen.getByTestId('form-save'));
    const edited = screen.getByRole('heading', { name: 'Old Shop' }).closest('article').parentElement;
    fireEvent.click(within(edited).getByTestId('receipt-items-toggle'));
    expect(within(edited).getByTestId('receipt-item-row').textContent).toContain('新名');
    expect(within(edited).getByTestId('receipt-item-row').textContent).not.toContain('Old');
  });

  it('keeps explicit scan items in the standalone ref save', () => {
    window.location.hash = '#add&date=2026-10-22';
    const draft = {
      id: 'ref-scan',
      store: 'Ref Shop ZZ',
      originalAmount: 80,
      currency: 'JPY',
      category: '飲食',
      date: '2026-10-22',
      items: [{ name: '參考茶', price: 80, name_en: 'Ref tea' }],
    };
    render(createElement(I18nextProvider, { i18n }, createElement(RefProto, {
      scanDraft: draft,
      scanState: { status: 'ready', token: 'ref-scan', draft },
    })));
    openItems();
    fireEvent.change(screen.getByTestId('receipt-item-name'), { target: { value: '參考新茶' } });
    fireEvent.click(screen.getByTestId('form-save'));
    const card = screen.getByRole('heading', { name: 'Ref Shop ZZ' }).closest('article').parentElement;
    fireEvent.click(within(card).getByTestId('receipt-items-toggle'));
    expect(within(card).getByTestId('receipt-item-row').textContent).toContain('參考新茶');
    expect(within(card).getByTestId('receipt-item-row').textContent).not.toContain('Ref tea');
  });
});
