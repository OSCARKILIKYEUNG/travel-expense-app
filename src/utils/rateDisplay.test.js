import { describe, it, expect } from 'vitest';
import { formatExchangeRateInputValue } from './rateDisplay';

describe('formatExchangeRateInputValue', () => {
  it('home currency shows 1', () => {
    expect(formatExchangeRateInputValue('HKD', 1, 'HKD', false, [])).toBe('1');
  });

  it('non-manual non-edited shows 2 decimals', () => {
    expect(formatExchangeRateInputValue('JPY', 19.234567, 'HKD', false, [])).toBe('19.23');
  });

  it('manual shows full string', () => {
    expect(formatExchangeRateInputValue('TWD', 4.123456, 'HKD', true, [])).toBe('4.123456');
  });

  it('user-edited shows full string', () => {
    expect(formatExchangeRateInputValue('JPY', 19.234567, 'HKD', false, ['JPY'])).toBe('19.234567');
  });
});
