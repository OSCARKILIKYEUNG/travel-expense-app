import { describe, expect, it } from 'vitest';
import { resolveAssigneeDisplay } from '../../utils/people';
import {
  getPartialMatchPersonShareHKD,
  getPartialMatchPersonShareOriginal,
} from '../../utils/personShare';
import { createRefTrip, REF_TODAY } from './mockRefTrip';
import { remainingPerDay } from './refCharts';
import { ledgerExpenseShare, ledgerTotalSummary, splitHKD } from './refLedgerTotal';
import { filterExpenses, personCounts } from './refLogic';

const trip = createRefTrip();
const all = trip.expenses;
const people = trip.settings.people;

function classicDashboardTotalHKD(expenses, filterPerson, exchangeRates, peopleList, defaultAssignee = '共同') {
  if (!filterPerson || filterPerson === '全部') {
    return expenses.reduce((a, c) => a + c.hkdAmount, 0);
  }
  let total = 0;
  for (const e of expenses) {
    const whole = resolveAssigneeDisplay(e.assignedTo, peopleList) === filterPerson;
    if (whole) {
      total += e.hkdAmount;
    } else if (e.items?.some((i) => (i.assignedTo || resolveAssigneeDisplay(e.assignedTo, peopleList)) === filterPerson)) {
      total += getPartialMatchPersonShareHKD(e, filterPerson, exchangeRates, defaultAssignee);
    }
  }
  return total;
}

describe('ledgerTotalSummary', () => {
  it('computes Tokyo unfiltered totals and budget 15000 matching remainingPerDay.pct', () => {
    const shown = filterExpenses(all, {}, people);
    const summary = ledgerTotalSummary({
      shown,
      all,
      budget: 15000,
      filtered: false,
    });

    expect(summary).toEqual({
      hkd: 11222,
      count: 17,
      jpy: 213352,
      filtered: false,
      budget: {
        budget: 15000,
        spent: 11222,
        pct: 75,
        barPct: 75,
        filteredPct: null,
        over: false,
        overBy: 0,
      },
    });

    const rem = remainingPerDay({
      budget: 15000,
      expenses: all,
      startDate: trip.startDate,
      endDate: trip.endDate,
      today: REF_TODAY,
    });
    expect(summary.budget.pct).toBe(rem.pct);
  });

  it('computes 飲食 filter totals and filteredPct with trip-level spent', () => {
    const shown = filterExpenses(all, { category: '飲食' }, people);
    const summary = ledgerTotalSummary({
      shown,
      all,
      budget: 15000,
      filtered: true,
    });

    expect(summary.hkd).toBe(4226);
    expect(summary.count).toBe(6);
    expect(summary.jpy).toBe(80340);
    expect(summary.filtered).toBe(true);
    expect(summary.budget).toEqual({
      budget: 15000,
      spent: 11222,
      pct: 75,
      barPct: 75,
      filteredPct: 28,
      over: false,
      overBy: 0,
    });
  });

  it('computes person Oscar filter totals and filteredPct', () => {
    const shown = filterExpenses(all, { person: 'Oscar' }, people);
    const summary = ledgerTotalSummary({
      shown,
      all,
      budget: 15000,
      filtered: true,
    });

    expect(summary.hkd).toBe(1926);
    expect(summary.count).toBe(5);
    expect(summary.jpy).toBe(36620);
    expect(summary.budget.filteredPct).toBe(13);
  });

  it('computes 飲食 + Oscar combined filter totals', () => {
    const shown = filterExpenses(all, { category: '飲食', person: 'Oscar' }, people);
    const summary = ledgerTotalSummary({
      shown,
      all,
      budget: 15000,
      filtered: true,
    });

    expect(summary.hkd).toBe(493);
    expect(summary.count).toBe(2);
    expect(summary.jpy).toBe(9380);
  });

  it('returns null budget when budget is null, 0, negative or NaN', () => {
    expect(ledgerTotalSummary({ shown: all, all, budget: null, filtered: false }).budget).toBeNull();
    expect(ledgerTotalSummary({ shown: all, all, budget: 0, filtered: false }).budget).toBeNull();
    expect(ledgerTotalSummary({ shown: all, all, budget: -500, filtered: false }).budget).toBeNull();
    expect(ledgerTotalSummary({ shown: all, all, budget: Number.NaN, filtered: false }).budget).toBeNull();
  });

  it('computes budget 12000 (pct 94) and over-budget 10000 (pct 112, barPct 100, over true, overBy 1222)', () => {
    const b12k = ledgerTotalSummary({ shown: all, all, budget: 12000, filtered: false });
    expect(b12k.budget.pct).toBe(94);
    expect(b12k.budget.over).toBe(false);

    const b10k = ledgerTotalSummary({ shown: all, all, budget: 10000, filtered: false });
    expect(b10k.budget).toEqual({
      budget: 10000,
      spent: 11222,
      pct: 112,
      barPct: 100,
      filteredPct: null,
      over: true,
      overBy: 1222,
    });
  });

  it('handles empty shown with filtered true', () => {
    const summary = ledgerTotalSummary({
      shown: [],
      all,
      budget: 15000,
      filtered: true,
    });

    expect(summary.hkd).toBe(0);
    expect(summary.count).toBe(0);
    expect(summary.jpy).toBe(0);
    expect(summary.filtered).toBe(true);
    expect(summary.budget.filteredPct).toBe(0);
  });

  it('matches classic Dashboard partial-share HKD and recordCount when person filter includes partial line-items', () => {
    const exchangeRates = { HKD: 1, JPY: 20 };
    const peopleList = ['共同', 'Oscar', '阿明'];
    const fixture = [
      {
        id: 101,
        date: '2026年10月20日',
        store: 'UNIQLO 銀座',
        category: '購物',
        assignedTo: 'Oscar',
        currency: 'JPY',
        originalCurrency: 'JPY',
        originalAmount: 10000,
        hkdAmount: 500,
        items: [],
      },
      {
        id: 102,
        date: '2026年10月21日',
        store: '松本清 澀谷店',
        category: '購物',
        assignedTo: '共同',
        currency: 'JPY',
        originalCurrency: 'JPY',
        originalAmount: 10000,
        hkdAmount: 500,
        items: [
          { name: '感冒藥', price: 6000, assignedTo: 'Oscar' },
          { name: '面膜', price: 4000, assignedTo: '阿明' },
        ],
      },
      {
        id: 103,
        date: '2026年10月22日',
        store: '一蘭拉麵',
        category: '飲食',
        assignedTo: '阿明',
        currency: 'JPY',
        originalCurrency: 'JPY',
        originalAmount: 2000,
        hkdAmount: 100,
        items: [],
      },
    ];

    const shownOscar = filterExpenses(fixture, { person: 'Oscar' }, peopleList);
    expect(shownOscar).toHaveLength(2);
    expect(personCounts(fixture, peopleList)).toEqual({
      全部: 3,
      共同: 1,
      Oscar: 2,
      阿明: 2,
    });

    const partialOscarHkd = getPartialMatchPersonShareHKD(
      fixture[1],
      'Oscar',
      exchangeRates,
      '共同',
    );
    expect(partialOscarHkd).toBe(300);

    const partialOscarJpy = getPartialMatchPersonShareOriginal(
      fixture[1],
      'Oscar',
      '共同',
    );
    expect(partialOscarJpy).toBe(6000);

    const oscarSummary = ledgerTotalSummary({
      shown: shownOscar,
      all: fixture,
      budget: 2000,
      filtered: true,
      person: 'Oscar',
      people: peopleList,
      exchangeRates,
      defaultAssignee: '共同',
    });

    const expectedDashboardOscarHkd = classicDashboardTotalHKD(
      fixture,
      'Oscar',
      exchangeRates,
      peopleList,
      '共同',
    );
    expect(expectedDashboardOscarHkd).toBe(800);
    expect(oscarSummary.hkd).toBe(expectedDashboardOscarHkd);
    expect(oscarSummary.count).toBe(2);
    expect(oscarSummary.jpy).toBe(16000);
    expect(oscarSummary.budget.spent).toBe(1100);
    expect(oscarSummary.budget.filteredPct).toBe(40);

    // Also verify 阿明 partial share parity (100 whole + 200 partial = 300 HKD)
    const shownMing = filterExpenses(fixture, { person: '阿明' }, peopleList);
    const mingSummary = ledgerTotalSummary({
      shown: shownMing,
      all: fixture,
      budget: 2000,
      filtered: true,
      person: '阿明',
      people: peopleList,
      exchangeRates,
      defaultAssignee: '共同',
    });
    expect(mingSummary.hkd).toBe(
      classicDashboardTotalHKD(fixture, '阿明', exchangeRates, peopleList, '共同'),
    );
    expect(mingSummary.hkd).toBe(300);
    expect(mingSummary.count).toBe(2);
    expect(mingSummary.jpy).toBe(6000);

    // Non-person filter (e.g. category='購物') still sums full hkdAmount of shown
    const shownShopping = filterExpenses(fixture, { category: '購物' }, peopleList);
    const shoppingSummary = ledgerTotalSummary({
      shown: shownShopping,
      all: fixture,
      budget: 2000,
      filtered: true,
      person: '全部',
      people: peopleList,
      exchangeRates,
    });
    expect(shoppingSummary.hkd).toBe(1000);
    expect(shoppingSummary.count).toBe(2);
    expect(ledgerExpenseShare(null)).toEqual({ hkd: 0, jpy: 0 });
  });
});

describe('splitHKD', () => {
  it('formats HK$ prefix and en-US grouped digits', () => {
    expect(splitHKD(11222)).toEqual({ prefix: 'HK$', digits: '11,222' });
    expect(splitHKD(0)).toEqual({ prefix: 'HK$', digits: '0' });
    expect(splitHKD(493.4)).toEqual({ prefix: 'HK$', digits: '493' });
  });
});
