import { describe, expect, it } from 'vitest';
import { getExchangeRate } from '../../utils/currency';
import { assigneeSplit, settleUp } from './refCharts';
import { ledgerTotalSummary } from './refLedgerTotal';
import { filterExpenses } from './refLogic';
import { expenseAllocation, personOwed } from './refShares';

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
