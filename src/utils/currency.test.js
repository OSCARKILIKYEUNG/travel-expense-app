import { describe, it, expect } from 'vitest';
import { getExchangeRate, toHome, resolveReceiptCurrency, formatNumber, formatMoney, formatCurrency } from './currency';

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

describe('formatNumber / formatMoney', () => {
  it('groups with en-US separators', () => {
    expect(formatNumber(12345)).toBe('12,345');
    expect(formatNumber(1234.4)).toBe('1,234');
    expect(formatNumber(12, 2)).toBe('12.00');
    expect(formatNumber(-1234)).toBe('-1,234');
  });

  it('renders non-finite values as zero', () => {
    expect(formatNumber(NaN)).toBe('0');
    expect(formatNumber(Infinity)).toBe('0');
    expect(formatNumber(undefined)).toBe('0');
    expect(formatMoney(NaN, { code: 'HKD' })).toBe('HKD $0');
  });

  it('formatMoney places code, prefix, and sign', () => {
    expect(formatMoney(12345, { code: 'HKD' })).toBe('HKD $12,345');
    expect(formatMoney(12345)).toBe('$12,345');
    expect(formatMoney(12345, { prefix: '' })).toBe('12,345');
    expect(formatMoney(-1234, { code: 'HKD' })).toBe('-HKD $1,234');
    expect(formatMoney(-1234)).toBe('-$1,234');
    expect(formatMoney(-1234, { prefix: '' })).toBe('-1,234');
  });

  it('formatCurrency delegates grouping to formatNumber', () => {
    expect(formatCurrency(12345)).toBe('$12,345');
    expect(formatCurrency(-99, { prefix: '¥' })).toBe('-¥99');
    expect(formatCurrency(12.5, { decimals: 2, prefix: '' })).toBe('12.50');
  });
});

describe('formatMoney auto decimals and sign (interrogate A2)', () => {
  it('keeps cents for fractional receipts and none for whole ones', async () => {
    const { formatMoney, autoDecimals } = await import('./currency.js');
    expect(formatMoney(13.75, { code: 'USD', decimals: 'auto' })).toBe('USD $13.75');
    expect(formatMoney(2360, { code: 'JPY', decimals: 'auto' })).toBe('JPY $2,360');
    expect(formatMoney(1234567.5, { code: 'EUR', decimals: 'auto' })).toBe('EUR $1,234,567.50');
    expect(autoDecimals(10)).toBe(0);
  });
  it('drops the minus sign when the rounded value is zero', async () => {
    const { formatMoney } = await import('./currency.js');
    expect(formatMoney(-0.2, { code: 'HKD' })).toBe('HKD $0');
    expect(formatMoney(-1234.4, { code: 'HKD' })).toBe('-HKD $1,234');
  });
});
