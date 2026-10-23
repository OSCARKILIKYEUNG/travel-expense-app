import { describe, expect, it } from 'vitest';
import { createRefTrip, REF_TODAY } from './mockRefTrip';
import { remainingPerDay } from './refCharts';
import { ledgerTotalSummary, resolveTotalVariant, splitHKD } from './refLedgerTotal';
import { filterExpenses } from './refLogic';

const trip = createRefTrip();
const all = trip.expenses;
const people = trip.settings.people;

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
});

describe('resolveTotalVariant', () => {
  it('returns b only for b or B, and a for everything else', () => {
    expect(resolveTotalVariant('')).toBe('a');
    expect(resolveTotalVariant('?proto=ref')).toBe('a');
    expect(resolveTotalVariant('?proto=ref&total=b')).toBe('b');
    expect(resolveTotalVariant('?total=B')).toBe('b');
    expect(resolveTotalVariant('?total=x')).toBe('a');
  });
});

describe('splitHKD', () => {
  it('formats HK$ prefix and en-US grouped digits', () => {
    expect(splitHKD(11222)).toEqual({ prefix: 'HK$', digits: '11,222' });
    expect(splitHKD(0)).toEqual({ prefix: 'HK$', digits: '0' });
    expect(splitHKD(493.4)).toEqual({ prefix: 'HK$', digits: '493' });
  });
});
