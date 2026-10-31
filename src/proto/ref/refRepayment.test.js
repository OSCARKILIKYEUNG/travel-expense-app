import { describe, expect, it } from 'vitest';
import { groupLedger } from './refLogic';
import {
  buildSettlementRow,
  filterSettlements,
  hasUnknownParticipant,
  mergeGroupsWithSettlements,
  resolveTripAccountingCurrency,
  resolveTripForeignCurrency,
  resolveTripRefRate,
} from './refRepayment';

describe('refRepayment pure helpers', () => {
  it('computes hkdAmount and rate=1 for accounting currency', () => {
    const row = buildSettlementRow(
      {
        from: '阿明',
        to: 'Oscar',
        amount: '500',
        currency: 'HKD',
        date: '2026-10-22',
        note: '現金還款',
      },
      { accountingCurrency: 'HKD', tripCurrency: 'JPY', rate: 0.0526 },
    );

    expect(row).toEqual({
      from: '阿明',
      to: 'Oscar',
      amount: 500,
      currency: 'HKD',
      hkdAmount: 500,
      rate: 1,
      date: '2026-10-22',
      note: '現金還款',
    });
  });

  it('converts trip currency with rate snapshot and rounds hkdAmount to nearest $1', () => {
    const row = buildSettlementRow(
      {
        id: 'stl-1',
        from: '阿明',
        to: 'Oscar',
        amount: 5000,
        currency: 'JPY',
        date: '2026-10-22',
        note: '',
      },
      { accountingCurrency: 'HKD', tripCurrency: 'JPY', rate: 0.0526 },
    );

    expect(row).toEqual({
      id: 'stl-1',
      from: '阿明',
      to: 'Oscar',
      amount: 5000,
      currency: 'JPY',
      hkdAmount: 263,
      rate: 0.0526,
      date: '2026-10-22',
      note: '',
    });
  });

  it('resolves trip currencies and ref rate with safe fallbacks', () => {
    expect(resolveTripAccountingCurrency({ accountingCurrency: 'twd' })).toBe('TWD');
    expect(resolveTripAccountingCurrency({})).toBe('HKD');
    expect(resolveTripForeignCurrency({ tripCurrency: 'krw' })).toBe('KRW');
    expect(resolveTripForeignCurrency({})).toBe('JPY');
    expect(resolveTripRefRate({ settings: { rate: 0.06 } })).toBe(0.06);
    expect(resolveTripRefRate({ tripCurrency: 'HKD', accountingCurrency: 'HKD' })).toBe(1);
  });

  it('flags settlements with unknown participants', () => {
    expect(hasUnknownParticipant({ from: 'Oscar', to: '阿明' }, ['Oscar', '阿明'])).toBe(false);
    expect(hasUnknownParticipant({ from: '舊成員', to: 'Oscar' }, ['Oscar', '阿明'])).toBe(true);
    expect(hasUnknownParticipant({ from: 'Oscar', to: '共同' }, ['Oscar', '阿明'])).toBe(true);
  });

  it('filters settlements by payer, person, date, search, and hides on category/payment filter', () => {
    const list = [
      { id: 's1', from: '阿明', to: 'Oscar', hkdAmount: 300, date: '2026-10-22', note: 'PayMe' },
      { id: 's2', from: 'Oscar', to: 'May', hkdAmount: 100, date: '2026-10-21', note: '轉數快' },
      { id: 's3', from: 'May', to: '阿明', hkdAmount: 50, date: '', note: '現金' },
    ];

    expect(filterSettlements(list).map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    expect(filterSettlements(list, { category: '飲食' })).toEqual([]);
    expect(filterSettlements(list, { payment: 'cash' })).toEqual([]);
    expect(filterSettlements(list, { payer: '阿明' }).map((s) => s.id)).toEqual(['s1']);
    expect(filterSettlements(list, { person: '阿明' }).map((s) => s.id)).toEqual(['s1', 's3']);
    expect(filterSettlements(list, { date: '2026-10-22' }).map((s) => s.id)).toEqual(['s1']);
    expect(filterSettlements(list, { date: 'undated' }).map((s) => s.id)).toEqual(['s3']);
    expect(filterSettlements(list, { query: 'payme' }).map((s) => s.id)).toEqual(['s1']);
    expect(filterSettlements(list, { query: 'May' }).map((s) => s.id)).toEqual(['s2', 's3']);
  });

  it('merges settlements into groupLedger output without changing expense day totals', () => {
    const expenses = [
      { id: 'e1', date: '2026-10-22', hkdAmount: 400, store: '拉麵' },
    ];
    const settlements = [
      { id: 's1', date: '2026-10-22', hkdAmount: 200, from: '阿明', to: 'Oscar' },
      { id: 's2', date: '2026-10-23', hkdAmount: 150, from: '阿明', to: 'Oscar' },
    ];

    const groups = groupLedger(expenses);
    const merged = mergeGroupsWithSettlements(groups, settlements);

    expect(merged.map((g) => g.key)).toEqual(['2026-10-23', '2026-10-22']);
    expect(merged[0].total).toBe(0);
    expect(merged[0].settlements).toHaveLength(1);
    expect(merged[1].total).toBe(400);
    expect(merged[1].settlements).toHaveLength(1);
  });
});
