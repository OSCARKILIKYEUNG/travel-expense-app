import { describe, it, expect } from 'vitest';
import {
  getItemActualPrice,
  sumAllItemActualPrices,
  sumFixedFeeActual,
  getEffectiveRefundPositive,
  getPartialMatchPersonShareOriginal,
  getPartialRefundShareOriginal,
} from './personShare';

describe('personShare', () => {
  it('getItemActualPrice prefers priceActual', () => {
    expect(getItemActualPrice({ price: 1000, priceActual: 900 })).toBe(900);
    expect(getItemActualPrice({ price: 1000 })).toBe(1000);
  });

  it('sumAllItemActualPrices sums actuals', () => {
    const items = [{ price: 100, priceActual: 80 }, { price: 200 }];
    expect(sumAllItemActualPrices(items)).toBe(280);
  });

  it('sumFixedFeeActual only counts fixed rows', () => {
    const items = [
      { name: '商品', price: 1000 },
      { name: 'GB Commis', price: 286, excludeFromRefundSplit: true },
    ];
    expect(sumFixedFeeActual(items)).toBe(286);
  });

  it('getEffectiveRefundPositive uses taxRefund when set', () => {
    const e = { currency: 'JPY', taxRefund: -500, originalAmount: 9500, items: [], subtotal: 10000 };
    expect(getEffectiveRefundPositive(e)).toBe(500);
  });

  it('getPartialMatchPersonShareOriginal uses uniform P×S/G when no fixed fee complexity', () => {
    const expense = {
      currency: 'JPY',
      originalAmount: 1000,
      hkdAmount: 50,
      assignedTo: '共同',
      items: [
        { name: 'a', price: 600, assignedTo: 'A' },
        { name: 'b', price: 400, assignedTo: 'B' },
      ],
    };
    const share = getPartialMatchPersonShareOriginal(expense, 'A', '共同');
    expect(share).toBe(600);
  });

  it('getPartialRefundShareOriginal returns 0 when no refund', () => {
    const expense = {
      currency: 'JPY',
      taxRefund: 0,
      originalAmount: 1000,
      items: [{ price: 1000, assignedTo: 'A' }],
    };
    expect(getPartialRefundShareOriginal(expense, 'A', '共同')).toBe(0);
  });
});
