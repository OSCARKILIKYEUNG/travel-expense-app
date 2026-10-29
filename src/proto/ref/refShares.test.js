import { describe, expect, it } from 'vitest';
import { getExchangeRate } from '../../utils/currency';
import { assigneeSplit, settleUp } from './refCharts';
import { ledgerTotalSummary } from './refLedgerTotal';
import { filterExpenses } from './refLogic';
import { expenseAllocation, personOwed, settlementBreakdown } from './refShares';

const peopleA = ['共同', 'A', 'B'];
const expensesA = [
  { id: 1, hkdAmount: 300, assignedTo: '共同', payer: 'A' },
  { id: 2, hkdAmount: 100, assignedTo: 'A', payer: 'B' },
  { id: 3, hkdAmount: 200, assignedTo: 'B', payer: 'B' },
  { id: 4, hkdAmount: 60, assignedTo: '', payer: '' },
  {
    id: 5,
    hkdAmount: 90,
    assignedTo: '共同',
    payer: 'A',
    items: [{ price: 30, assignedTo: 'B' }, { price: 60 }],
  },
];

const peopleB = ['人物A', '1'];
const expensesB = [
  { id: 1, hkdAmount: 500, assignedTo: '', payer: '人物A' },
  { id: 2, hkdAmount: 100, assignedTo: '', payer: '' },
  { id: 3, hkdAmount: 300, assignedTo: '共同', payer: '人物A' },
  {
    id: 4,
    hkdAmount: 80,
    assignedTo: '',
    payer: '1',
    items: [{ price: 80, assignedTo: '1' }],
  },
];

function expectAllocationInvariants(expenses, people, rates = null) {
  for (const expense of expenses) {
    const buckets = expenseAllocation(expense, people, rates);
    const bucketSum = Object.values(buckets).reduce((sum, n) => sum + n, 0);
    expect(bucketSum).toBe(expense.hkdAmount);
    const owed = personOwed(expense, people, rates);
    const owedSum = Object.values(owed).reduce((sum, n) => sum + n, 0);
    expect(owedSum).toBe(expense.hkdAmount);
  }
}

function personTotal(expenses, people, person, rates = null) {
  const shown = filterExpenses(expenses, { person }, people);
  return ledgerTotalSummary({
    shown,
    all: expenses,
    person,
    people,
    exchangeRates: rates,
  }).hkd;
}

describe('settlement allocation (brief a)', () => {
  it('settles A paid 450 owed 310 and B paid 300 owed 440, transfer 140', () => {
    expectAllocationInvariants(expensesA, peopleA, null);
    expect(() => settleUp(expensesA, peopleA, null)).not.toThrow();
    expect(() => assigneeSplit(expensesA, peopleA, null)).not.toThrow();
    expect(getExchangeRate('JPY', null)).toBe(1);
    expect(getExchangeRate('JPY', undefined)).toBe(1);

    const settled = settleUp(expensesA, peopleA, null);
    expect(settled.rows).toEqual([
      { person: 'A', paid: 450, owed: 310, net: 140 },
      { person: 'B', paid: 300, owed: 440, net: -140 },
    ]);
    expect(settled.transfers).toEqual([{ from: 'B', to: 'A', amount: 140 }]);

    const split = assigneeSplit(expensesA, peopleA, null);
    expect(split.total).toBe(750);
    expect(split.rows.map((row) => [row.person, row.total])).toEqual([
      ['共同', 420],
      ['A', 100],
      ['B', 230],
    ]);
    expect(split.rows.reduce((sum, row) => sum + row.total, 0)).toBe(750);
    expect(split.shares).toEqual([
      { person: 'A', share: 310 },
      { person: 'B', share: 440 },
    ]);
  });

  it('ledger payer and person totals match the settlement buckets', () => {
    const payerA = filterExpenses(expensesA, { payer: 'A' }, peopleA);
    expect(payerA.map((e) => e.id)).toEqual([1, 4, 5]);
    expect(
      ledgerTotalSummary({ shown: payerA, all: expensesA, person: '全部', people: peopleA, exchangeRates: null }).hkd,
    ).toBe(450);

    const payerB = filterExpenses(expensesA, { payer: 'B' }, peopleA);
    expect(payerB.map((e) => e.id)).toEqual([2, 3]);
    expect(
      ledgerTotalSummary({ shown: payerB, all: expensesA, person: '全部', people: peopleA, exchangeRates: null }).hkd,
    ).toBe(300);

    const shared = personTotal(expensesA, peopleA, '共同', null);
    const a = personTotal(expensesA, peopleA, 'A', null);
    const b = personTotal(expensesA, peopleA, 'B', null);
    expect(shared).toBe(420);
    expect(a).toBe(100);
    expect(b).toBe(230);
    expect(shared + a + b).toBe(750);
  });
});

describe('settlement allocation (brief b)', () => {
  it('blank assignee stays 共同 and blank payer falls back to the first participant', () => {
    expectAllocationInvariants(expensesB, peopleB, null);

    const settled = settleUp(expensesB, peopleB, null);
    expect(settled.rows).toEqual([
      { person: '人物A', paid: 900, owed: 450, net: 450 },
      { person: '1', paid: 80, owed: 530, net: -450 },
    ]);
    expect(settled.transfers).toEqual([{ from: '1', to: '人物A', amount: 450 }]);

    const split = assigneeSplit(expensesB, peopleB, null);
    expect(split.rows.map((row) => [row.person, row.total])).toEqual([
      ['共同', 900],
      ['人物A', 0],
      ['1', 80],
    ]);
    expect(split.shares).toEqual([
      { person: '人物A', share: 450 },
      { person: '1', share: 530 },
    ]);

    const payer = filterExpenses(expensesB, { payer: '人物A' }, peopleB);
    expect(payer.map((e) => e.id)).toEqual([1, 2, 3]);
    expect(
      ledgerTotalSummary({
        shown: payer,
        all: expensesB,
        person: '全部',
        people: peopleB,
        exchangeRates: null,
      }).hkd,
    ).toBe(900);

    expect(personTotal(expensesB, peopleB, '共同', null)).toBe(900);
    expect(personTotal(expensesB, peopleB, '人物A', null)).toBe(0);
    expect(personTotal(expensesB, peopleB, '1', null)).toBe(80);
    expect(900 + 0 + 80).toBe(980);
  });
});

describe('settlementBreakdown', () => {
  it('breaks down paid and owed lines for peopleA/expensesA and matches settleUp totals', () => {
    const settled = settleUp(expensesA, peopleA, null);
    const rowA = settled.rows.find((r) => r.person === 'A');
    const rowB = settled.rows.find((r) => r.person === 'B');

    const breakdownA = settlementBreakdown(expensesA, peopleA, null, 'A');
    expect(breakdownA.person).toBe('A');
    expect(breakdownA.paidTotal).toBe(450);
    expect(breakdownA.owedTotal).toBe(310);
    expect(breakdownA.net).toBe(140);
    expect(breakdownA.paidTotal).toBe(rowA.paid);
    expect(breakdownA.owedTotal).toBe(rowA.owed);
    expect(breakdownA.net).toBe(rowA.net);
    expect(breakdownA.paidLines.map((l) => ({ id: l.id, hkd: l.hkd, blankPayer: l.blankPayer }))).toEqual([
      { id: 1, hkd: 300, blankPayer: false },
      { id: 4, hkd: 60, blankPayer: true },
      { id: 5, hkd: 90, blankPayer: false },
    ]);
    // Expense 3 is assigned to B (A owes 0), so it is skipped in A's owedLines
    expect(breakdownA.owedLines.map((l) => ({ id: l.id, own: l.own, sharedPart: l.sharedPart, sharedCount: l.sharedCount, total: l.total }))).toEqual([
      { id: 1, own: 0, sharedPart: 300, sharedCount: 2, total: 150 },
      { id: 2, own: 100, sharedPart: 0, sharedCount: 2, total: 100 },
      { id: 4, own: 0, sharedPart: 60, sharedCount: 2, total: 30 },
      { id: 5, own: 0, sharedPart: 60, sharedCount: 2, total: 30 },
    ]);

    const breakdownB = settlementBreakdown(expensesA, peopleA, null, 'B');
    expect(breakdownB.person).toBe('B');
    expect(breakdownB.paidTotal).toBe(300);
    expect(breakdownB.owedTotal).toBe(440);
    expect(breakdownB.net).toBe(-140);
    expect(breakdownB.paidTotal).toBe(rowB.paid);
    expect(breakdownB.owedTotal).toBe(rowB.owed);
    expect(breakdownB.net).toBe(rowB.net);
    expect(breakdownB.paidLines.map((l) => ({ id: l.id, hkd: l.hkd, blankPayer: l.blankPayer }))).toEqual([
      { id: 2, hkd: 100, blankPayer: false },
      { id: 3, hkd: 200, blankPayer: false },
    ]);
    // Expense 2 is assigned to A (B owes 0), so it is skipped in B's owedLines
    expect(breakdownB.owedLines.map((l) => ({ id: l.id, own: l.own, sharedPart: l.sharedPart, sharedCount: l.sharedCount, total: l.total }))).toEqual([
      { id: 1, own: 0, sharedPart: 300, sharedCount: 2, total: 150 },
      { id: 3, own: 200, sharedPart: 0, sharedCount: 2, total: 200 },
      { id: 4, own: 0, sharedPart: 60, sharedCount: 2, total: 30 },
      { id: 5, own: 30, sharedPart: 60, sharedCount: 2, total: 60 },
    ]);
  });

  it('breaks down paid and owed lines for peopleB/expensesB and marks blank-payer expense on 人物A', () => {
    const settled = settleUp(expensesB, peopleB, null);
    const rowPersonA = settled.rows.find((r) => r.person === '人物A');
    const rowOne = settled.rows.find((r) => r.person === '1');

    const breakdownPersonA = settlementBreakdown(expensesB, peopleB, null, '人物A');
    expect(breakdownPersonA.person).toBe('人物A');
    expect(breakdownPersonA.paidTotal).toBe(900);
    expect(breakdownPersonA.owedTotal).toBe(450);
    expect(breakdownPersonA.net).toBe(450);
    expect(breakdownPersonA.paidTotal).toBe(rowPersonA.paid);
    expect(breakdownPersonA.owedTotal).toBe(rowPersonA.owed);
    expect(breakdownPersonA.net).toBe(rowPersonA.net);
    expect(breakdownPersonA.paidLines.map((l) => ({ id: l.id, hkd: l.hkd, blankPayer: l.blankPayer }))).toEqual([
      { id: 1, hkd: 500, blankPayer: false },
      { id: 2, hkd: 100, blankPayer: true },
      { id: 3, hkd: 300, blankPayer: false },
    ]);
    expect(breakdownPersonA.owedLines.map((l) => ({ id: l.id, total: l.total }))).toEqual([
      { id: 1, total: 250 },
      { id: 2, total: 50 },
      { id: 3, total: 150 },
    ]);

    const breakdownOne = settlementBreakdown(expensesB, peopleB, null, '1');
    expect(breakdownOne.person).toBe('1');
    expect(breakdownOne.paidTotal).toBe(80);
    expect(breakdownOne.owedTotal).toBe(530);
    expect(breakdownOne.net).toBe(-450);
    expect(breakdownOne.paidTotal).toBe(rowOne.paid);
    expect(breakdownOne.owedTotal).toBe(rowOne.owed);
    expect(breakdownOne.net).toBe(rowOne.net);
    expect(breakdownOne.paidLines.map((l) => ({ id: l.id, hkd: l.hkd, blankPayer: l.blankPayer }))).toEqual([
      { id: 4, hkd: 80, blankPayer: false },
    ]);
    expect(breakdownOne.owedLines.map((l) => ({ id: l.id, own: l.own, sharedPart: l.sharedPart, total: l.total }))).toEqual([
      { id: 1, own: 0, sharedPart: 500, total: 250 },
      { id: 2, own: 0, sharedPart: 100, total: 50 },
      { id: 3, own: 0, sharedPart: 300, total: 150 },
      { id: 4, own: 80, sharedPart: 0, total: 80 },
    ]);
  });
});

