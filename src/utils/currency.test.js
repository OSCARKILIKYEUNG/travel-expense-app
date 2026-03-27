import { describe, it, expect } from 'vitest';
import { getExchangeRate, toHome, resolveReceiptCurrency } from './currency';

describe('currency', () => {
  const rates = { JPY: 20, USD: 0.13, HKD: 1 };

  it('getExchangeRate falls back to 1', () => {
    expect(getExchangeRate('JPY', rates)).toBe(20);
    expect(getExchangeRate('XXX', rates)).toBe(1);
  });

  it('toHome divides by rate', () => {
    expect(toHome(2000, 'JPY', rates)).toBe(100);
    expect(toHome(100, 'HKD', rates)).toBe(100);
  });

  it('resolveReceiptCurrency prefers AI currency when in CURRENCY_NAMES', () => {
    const parsed = { currency: 'USD' };
    expect(resolveReceiptCurrency(parsed, 'HKD', 'JPY')).toBe('USD');
  });

  it('resolveReceiptCurrency uses trip when AI missing', () => {
    expect(resolveReceiptCurrency({}, 'HKD', 'JPY')).toBe('JPY');
  });
});
