import { describe, it, expect } from 'vitest';
import { recalculateExpensesForRates } from './recalculateExpensesForRates';

describe('recalculateExpensesForRates', () => {
  it('returns changed false when amounts already match rates', () => {
    const rates = { JPY: 20 };
    const expenses = [
      { id: 1, currency: 'JPY', originalAmount: 2000, hkdAmount: 100, rate: 20 },
    ];
    const { changed, expenses: out } = recalculateExpensesForRates(expenses, rates);
    expect(changed).toBe(false);
    expect(out[0].hkdAmount).toBe(100);
  });

  it('updates hkdAmount when rate implies different home amount', () => {
    const rates = { JPY: 25 };
    const expenses = [
      { id: 1, currency: 'JPY', originalAmount: 2000, hkdAmount: 100, rate: 20 },
    ];
    const { changed, expenses: out } = recalculateExpensesForRates(expenses, rates);
    expect(changed).toBe(true);
    expect(out[0].hkdAmount).toBe(80);
    expect(out[0].rate).toBe(25);
  });

  it('skips rows without currency or amount (legacy behavior)', () => {
    const rates = { JPY: 20 };
    const expenses = [{ id: 1, currency: '', originalAmount: 100, hkdAmount: 0 }];
    const { changed } = recalculateExpensesForRates(expenses, rates);
    expect(changed).toBe(false);
  });
});
