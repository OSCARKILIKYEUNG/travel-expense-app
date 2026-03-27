import { describe, it, expect } from 'vitest';
import { mergeExchangeRates, rebaseRates } from './ExchangeRateService';

describe('ExchangeRateService', () => {
  it('rebaseRates pivots new home to 1 and scales others', () => {
    const old = { HKD: 7.8, USD: 0.128, JPY: 20 };
    const next = rebaseRates(old, 'USD');
    expect(next.USD).toBe(1);
    expect(next.HKD).toBeCloseTo(7.8 / 0.128, 5);
  });

  it('mergeExchangeRates preserves manual codes and sets home to 1', () => {
    const existing = { HKD: 1, JPY: 10, USD: 0.12 };
    const fetched = { JPY: 20, USD: 0.13 };
    const merged = mergeExchangeRates(existing, fetched, 'HKD', ['JPY']);
    expect(merged.HKD).toBe(1);
    expect(merged.JPY).toBe(10);
    expect(merged.USD).toBe(0.13);
  });
});
