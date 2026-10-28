import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { toRefExpense } from '../adapters/refDataAdapter';
import { ledgerTotalSummary } from '../proto/ref/refLedgerTotal';
import { filterExpenses, groupLedger, personCounts, undatedHint } from '../proto/ref/refLogic';
import { applyUndo } from '../proto/ref/refRules';
import { getPartialMatchPersonShareHKD } from '../utils/personShare';
import NotebookApp, { buildDeleteUndo, buildSaveUndo } from './NotebookApp';
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
