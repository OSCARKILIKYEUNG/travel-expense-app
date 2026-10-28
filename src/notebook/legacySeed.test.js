import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import { toRefExpense } from '../adapters/refDataAdapter';
import i18n from '../i18n';
import { ledgerTotalSummary } from '../proto/ref/refLedgerTotal';
import { filterExpenses, groupLedger, personCounts, undatedHint } from '../proto/ref/refLogic';
import { applyUndo } from '../proto/ref/refRules';
import DataService from '../services/DataService';
import { getPartialMatchPersonShareHKD } from '../utils/personShare';
import NotebookApp, { buildDeleteUndo, buildSaveUndo } from './NotebookApp';
import { applyNotebookTripDates } from './SettingsView';
import {
  LEGACY_EXCHANGE_RATES,
  createLegacySeedTrip,
  createLegacySeedTrips,
  isLegacySeed,
  resolveNotebookSeed,
} from './legacySeed';
import { adaptTripForNotebook, preparePersistedExpense } from './tripRate';

describe('legacySeed — ?proto=notebook&seed=legacy resolver and fixture shape', () => {
  it('resolves seed=legacy and keeps default mock behavior when seed is absent', () => {
    expect(resolveNotebookSeed('?proto=notebook&seed=legacy')).toBe('legacy');
    expect(resolveNotebookSeed('?proto=notebook&SEED=LEGACY&today=2026-10-22')).toBe('legacy');
    expect(resolveNotebookSeed('?proto=notebook')).toBe('default');
    expect(resolveNotebookSeed('?proto=notebook&seed=other')).toBe('default');
    expect(resolveNotebookSeed('')).toBe('default');

    expect(isLegacySeed('?proto=notebook&seed=legacy')).toBe(true);
    expect(isLegacySeed('?proto=notebook')).toBe(false);
  });

  it('provides store-shaped legacy expenses with zh/ISO dates, numeric ids, undated item, partial line-item assignee, and budget', () => {
    const trips = createLegacySeedTrips();
    expect(trips).toHaveLength(1);
    const legacy = createLegacySeedTrip();

    expect(legacy.settings.budget).toBe(15000);
    expect(legacy.expenses.length).toBeGreaterThanOrEqual(6);
    expect(legacy.expenses.length).toBeLessThanOrEqual(15);
    expect(legacy.expenses.every((e) => typeof e.id === 'number')).toBe(true);
    expect(legacy.expenses.some((e) => e.date.includes('年'))).toBe(true);
    expect(legacy.expenses.some((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date))).toBe(true);
    expect(legacy.expenses.some((e) => !e.date)).toBe(true);
    expect(
      legacy.expenses.some(
        (e) =>
          e.assignedTo === '共同' &&
          Array.isArray(e.items) &&
          e.items.some((it) => it.assignedTo === 'Oscar'),
      ),
    ).toBe(true);

    // Passes cleanly through adaptTripForNotebook
    const adapted = adaptTripForNotebook(legacy, { today: '2026-10-22' });
    expect(adapted.startDate).toBe('2026-10-18');
    expect(adapted.endDate).toBe('2026-10-27');
    expect(adapted.settings.budget).toBe(15000);
    expect(adapted.expenses).toHaveLength(legacy.expenses.length);
    expect(adapted.expenses.every((e) => typeof e.place === 'string')).toBe(true);
    expect(adapted.expenses.every((e) => e.payment === 'cash' || e.payment === 'card')).toBe(true);
  });

  it('orders dated groups newest first, puts 未有日期 last, and computes undatedHint on adapted legacy seed', () => {
    const adapted = adaptTripForNotebook(createLegacySeedTrip(), { today: '2026-10-22' });
    const groups = groupLedger(adapted.expenses);

    expect(groups.length).toBeGreaterThan(1);
    expect(groups[0].iso).toBe('2026-10-22');
    expect(groups[groups.length - 1]).toMatchObject({
      key: 'undated',
      label: '未有日期',
      iso: null,
    });
    expect(groups[groups.length - 1].items).toHaveLength(1);
    expect(groups[groups.length - 1].items[0].store).toBe('燒肉 敘敘苑');

    expect(undatedHint(groups)).toEqual({
      count: 1,
      label: '1 筆未有日期',
    });
  });

  it('computes person-filter HKD on legacy seed matching Dashboard getPartialMatchPersonShareHKD', () => {
    const legacy = createLegacySeedTrip();
    const adapted = adaptTripForNotebook(legacy, { today: '2026-10-22' });
    const people = adapted.settings.people;

    // Oscar has 2 whole-card expenses (526 + 389 = 915) + 1 partial in 1729490000104 (6000/10000 of 500 = 300) -> 1215 HKD
    const shownOscar = filterExpenses(adapted.expenses, { person: 'Oscar' }, people);
    expect(shownOscar).toHaveLength(3);
    expect(personCounts(adapted.expenses, people).Oscar).toBe(3);

    const partialExp = adapted.expenses.find((e) => e.id === 1729490000104);
    const partialShare = getPartialMatchPersonShareHKD(
      partialExp,
      'Oscar',
      LEGACY_EXCHANGE_RATES,
      '共同',
    );
    expect(partialShare).toBe(300);

    const summary = ledgerTotalSummary({
      shown: shownOscar,
      all: adapted.expenses,
      budget: adapted.settings.budget,
      filtered: true,
      person: 'Oscar',
      people,
      exchangeRates: LEGACY_EXCHANGE_RATES,
      defaultAssignee: '共同',
    });

    expect(summary.hkd).toBe(526 + 389 + partialShare);
    expect(summary.hkd).toBe(1215);
    expect(summary.count).toBe(3);
    expect(summary.jpy).toBe(10000 + 7400 + 6000);
  });

  it('renders NotebookApp #ledger with seed=legacy showing LedgerTotalCard A, undated hint, and legacy expenses', () => {
    const html = renderToStaticMarkup(
      createElement(NotebookApp, {
        today: '2026-10-22',
        search: '?proto=notebook&seed=legacy',
        initialHash: '#ledger',
      }),
    );

    expect(html).toContain('data-testid="ledger"');
    expect(html).toContain('data-testid="ledger-total-card"');
    expect(html).toContain('data-variant="a"');
    expect(html).toContain('data-testid="ledger-undated-hint"');
    expect(html).toContain('data-testid="ledger-group-undated"');
    expect(html).toContain('松本清 澀谷店');
    expect(html).toContain('燒肉 敘敘苑');

    // Absent seed keeps default mockRefTrip behavior (17 expenses, HK$11,222)
    const defaultHtml = renderToStaticMarkup(
      createElement(NotebookApp, {
        today: '2026-10-22',
        search: '?proto=notebook',
        initialHash: '#ledger',
      }),
    );
    expect(defaultHtml).toContain('11,222');
    expect(defaultHtml).toContain('213,352');
  });
});

describe('Undo raw store records — delete, add, and edit round-trips', () => {
  it('delete -> applyUndo restores raw store record (location, paymentMethod, items, sourceHash) without ref-only fields', () => {
    const legacy = createLegacySeedTrip();
    const rawExpenses = legacy.expenses;
    const adaptedExpenses = rawExpenses.map((e) => toRefExpense(e));

    // User clicks delete on the adapted ref expense row in Ledger (id 1729490000104)
    const clickedRefRow = adaptedExpenses.find((e) => e.id === 1729490000104);
    expect(clickedRefRow.place).toBe('澀谷');
    expect(clickedRefRow.payment).toBe('card');

    // Raw store record before delete has location & paymentMethod ('信用卡'), and NO ref-only `place` or `payment`
    const originalRaw = rawExpenses.find((e) => e.id === 1729490000104);
    expect('place' in originalRaw).toBe(false);
    expect(originalRaw.location).toBe('澀谷');
    expect(originalRaw.paymentMethod).toBe('信用卡');
    expect(originalRaw.sourceHash).toBe('legacy-hash-104-partial');

    const undoOp = buildDeleteUndo(clickedRefRow, {
      rawExpenses,
      fallbackExpenses: adaptedExpenses,
    });

    const afterDelete = rawExpenses.filter((e) => e.id !== 1729490000104);
    expect(afterDelete).toHaveLength(rawExpenses.length - 1);

    const afterUndo = applyUndo(afterDelete, undoOp);
    expect(afterUndo).toHaveLength(rawExpenses.length);
    const restored = afterUndo.find((e) => e.id === 1729490000104);
    expect(restored).toEqual(originalRaw);
    expect('place' in restored).toBe(false);
    expect(restored.location).toBe('澀谷');
    expect(restored.paymentMethod).toBe('信用卡');
    expect(restored.sourceHash).toBe('legacy-hash-104-partial');
    expect(restored.items).toEqual(originalRaw.items);
  });

  it('add -> applyUndo snapshots persisted raw record and removes it cleanly by id', () => {
    const legacy = createLegacySeedTrip();
    const rawExpenses = legacy.expenses;

    const { record, refRecord } = preparePersistedExpense(
      {
        currency: 'JPY',
        originalAmount: 3800,
        store: '藍瓶咖啡 清澄白河',
        place: '清澄白河',
        category: '飲食',
        assignedTo: 'Oscar',
        payer: 'Oscar',
        payment: 'card',
        date: '2026-10-22',
        time: '10:30',
      },
      {
        tripCurrency: 'JPY',
        exchangeRates: LEGACY_EXCHANGE_RATES,
        now: new Date('2026-10-22T10:30:00.000Z'),
      },
    );

    const undoOp = buildSaveUndo({
      isEdit: false,
      id: record.id,
      rawExpenses,
      persistedRecord: record,
      savedRecord: refRecord,
    });

    expect(undoOp.expense).toEqual(record);
    expect(undoOp.expense.date).toBe('2026年10月22日');
    expect(undoOp.expense.location).toBe('清澄白河');
    expect(undoOp.expense.paymentMethod).toBe('card');

    const afterAdd = [...rawExpenses, record];
    const afterUndo = applyUndo(afterAdd, undoOp);
    expect(afterUndo).toEqual(rawExpenses);
  });

  it('edit -> applyUndo restores the pre-edit raw store record with original zh date, paymentMethod, and AI fields', () => {
    const legacy = createLegacySeedTrip();
    const rawExpenses = legacy.expenses;
    const adaptedExpenses = rawExpenses.map((e) => toRefExpense(e));
    const targetId = 1729490000104;
    const rawBefore = rawExpenses.find((e) => e.id === targetId);

    const { record: updatedRecord, refRecord: updatedRef } = preparePersistedExpense(
      {
        id: String(targetId),
        date: '2026-10-21',
        store: '松本清 澀谷旗艦店',
        place: '澀谷道玄坂',
        category: '購物',
        assignedTo: 'Oscar',
        payer: 'Oscar',
        payment: 'cash',
        time: '17:00',
        originalAmount: 12000,
      },
      {
        existing: rawBefore,
        tripCurrency: 'JPY',
        exchangeRates: LEGACY_EXCHANGE_RATES,
      },
    );

    const undoOp = buildSaveUndo({
      isEdit: true,
      id: updatedRecord.id,
      rawExpenses,
      fallbackExpenses: adaptedExpenses,
      persistedRecord: updatedRecord,
      savedRecord: updatedRef,
    });

    expect(undoOp.previous).toEqual(rawBefore);
    expect('place' in undoOp.previous).toBe(false);
    expect(undoOp.previous.paymentMethod).toBe('信用卡');

    const afterEdit = rawExpenses.map((e) => (e.id === targetId ? updatedRecord : e));
    const afterUndo = applyUndo(afterEdit, undoOp);
    expect(afterUndo.find((e) => e.id === targetId)).toEqual(rawBefore);
  });
});

describe('P4: ChartsView and SettingsView on seed=legacy and controlled persistence', () => {
  it('renders #charts with seed=legacy showing budget 15,000, cash/card split, assignee above settle, and shares subtitle', () => {
    const html = renderToStaticMarkup(
      createElement(NotebookApp, {
        today: '2026-10-22',
        search: '?proto=notebook&seed=legacy',
        initialHash: '#charts',
      }),
    );

    expect(html).toContain('data-testid="page-charts"');
    expect(html).toContain('data-section="today"');
    // Budget 15,000, spent 5,397 (36%), remaining per day 1,920
    expect(html).toContain('HK$15,000');
    expect(html).toContain('HK$5,397');
    expect(html).toContain('36%');
    expect(html).toContain('HK$1,920');

    // Payment split from paymentMethod -> cash 1,086 / card 4,311
    expect(html).toContain('data-testid="chart-pay-cash"');
    expect(html).toContain('data-testid="chart-pay-card"');
    expect(html).toContain('HK$1,086');
    expect(html).toContain('HK$4,311');

    // Assignee section sits strictly above Settle section
    const assigneeIdx = html.indexOf('data-section="assignee"');
    const settleIdx = html.indexOf('data-section="settle"');
    expect(assigneeIdx).toBeGreaterThan(0);
    expect(settleIdx).toBeGreaterThan(assigneeIdx);

    // Assignee rows + shares line
    expect(html).toContain('data-testid="chart-assignee-共同"');
    expect(html).toContain('data-testid="chart-assignee-Oscar"');
    expect(html).toContain('data-testid="chart-assignee-阿明"');
    expect(html).toContain('data-testid="chart-assignee-shares"');
    expect(html).toContain('連共同攤分：Oscar HK$2,939 · 阿明 HK$2,458');

    // Settle rows + transfer
    expect(html).toContain('data-testid="chart-person-Oscar"');
    expect(html).toContain('data-testid="chart-person-阿明"');
    expect(html).toContain('阿明 要還 Oscar HK$1,040');
  });

  it('renders #settings with seed=legacy showing trip-start-date, trip-end-date, trip-dates-save, budget, and language toggle in zh-TW and en', async () => {
    await i18n.changeLanguage('zh-TW');
    const zhHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          today: '2026-10-22',
          search: '?proto=notebook&seed=legacy',
          initialHash: '#settings',
          uiLanguage: 'zh-TW',
        }),
      ),
    );
    expect(zhHtml).toContain('data-testid="page-settings"');
    expect(zhHtml).toContain('data-testid="language-select"');
    expect(zhHtml).toContain('data-testid="trip-start-date"');
    expect(zhHtml).toContain('data-testid="trip-end-date"');
    expect(zhHtml).toContain('data-testid="trip-dates-save"');
    expect(zhHtml).toContain('value="2026-10-18"');
    expect(zhHtml).toContain('value="2026-10-27"');
    expect(zhHtml).toContain('旅程日期');
    expect(zhHtml).toContain('開始日期');
    expect(zhHtml).toContain('結束日期');
    expect(zhHtml).toContain('儲存日期');
    expect(zhHtml).toContain('data-testid="budget-input"');
    expect(zhHtml).toContain('value="15000"');

    await i18n.changeLanguage('en');
    const enHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          today: '2026-10-22',
          search: '?proto=notebook&seed=legacy',
          initialHash: '#settings',
          uiLanguage: 'en',
        }),
      ),
    );
    expect(enHtml).toContain('data-testid="trip-start-date"');
    expect(enHtml).toContain('data-testid="trip-end-date"');
    expect(enHtml).toContain('data-testid="trip-dates-save"');
    expect(enHtml).toContain('Trip dates');
    expect(enHtml).toContain('Start date');
    expect(enHtml).toContain('End date');
    expect(enHtml).toContain('Save dates');

    await i18n.changeLanguage('zh-TW');
  });

  it('applies and persists trip dates via applyNotebookTripDates on controlled (onSaveDates -> DataService.patchTrip) and uncontrolled (onUpdateTrip) paths', () => {
    const legacy = createLegacySeedTrip();
    const tZh = i18n.getFixedT('zh-TW');

    // 1. Controlled path (NotebookShell -> updateTrip -> DataService.patchTrip)
    const originalLocalStorage = globalThis.localStorage;
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
    DataService.setStorageScope('test-user-p4-dates');
    try {
      const initial = DataService.loadTripsData();
      const tripId = initial.currentTripId;
      const onToast = vi.fn();
      const onSaveDates = vi.fn(({ startDate, endDate }) => {
        DataService.patchTrip(tripId, { startDate, endDate });
      });

      const okRes = applyNotebookTripDates(
        legacy,
        { startDate: '2026-10-19', endDate: '2026-10-29' },
        { onSaveDates, onToast, t: tZh },
      );
      expect(okRes.ok).toBe(true);
      expect(onSaveDates).toHaveBeenCalledWith(
        { startDate: '2026-10-19', endDate: '2026-10-29' },
        expect.objectContaining({ startDate: '2026-10-19', endDate: '2026-10-29' }),
      );
      expect(onToast).toHaveBeenCalledWith('已更新旅程日期 2026-10-19 – 2026-10-29');

      const persisted = DataService.getCurrentTrip(DataService.loadTripsData());
      expect(persisted.startDate).toBe('2026-10-19');
      expect(persisted.endDate).toBe('2026-10-29');

      // Clearing endDate writes null and adaptTripForNotebook derives span from expenses
      applyNotebookTripDates(
        legacy,
        { startDate: '2026-10-18', endDate: '' },
        { onSaveDates, onToast, t: tZh },
      );
      const afterClear = DataService.getCurrentTrip(DataService.loadTripsData());
      expect(afterClear.startDate).toBe('2026-10-18');
      expect(afterClear.endDate).toBeNull();
      const adaptedCleared = adaptTripForNotebook(
        { ...legacy, startDate: afterClear.startDate, endDate: afterClear.endDate },
        { today: '2026-10-22' },
      );
      expect(adaptedCleared.endDate).toBe('2026-10-22');
    } finally {
      DataService.setStorageScope(null);
      globalThis.localStorage = originalLocalStorage;
    }

    // 2. Uncontrolled path (onUpdateTrip) and validation rejection
    const onUpdateTrip = vi.fn();
    const onToastMock = vi.fn();
    const badOrder = applyNotebookTripDates(
      legacy,
      { startDate: '2026-10-30', endDate: '2026-10-18' },
      { onUpdateTrip, onToast: onToastMock, t: tZh },
    );
    expect(badOrder).toEqual({
      ok: false,
      errorKey: 'notebook.settings.datesOrderError',
    });
    expect(onUpdateTrip).not.toHaveBeenCalled();
    expect(onToastMock).not.toHaveBeenCalled();

    const mockOk = applyNotebookTripDates(
      legacy,
      { startDate: '2026-10-18', endDate: '2026-10-25' },
      { onUpdateTrip, onToast: onToastMock, t: tZh },
    );
    expect(mockOk.ok).toBe(true);
    expect(onUpdateTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        id: legacy.id,
        startDate: '2026-10-18',
        endDate: '2026-10-25',
      }),
    );
  });
});
