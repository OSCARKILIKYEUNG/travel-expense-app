import { describe, it, expect } from 'vitest';
import { buildMergedSavedCurrencySettings } from './savedCurrencyMerge';

describe('buildMergedSavedCurrencySettings', () => {
  it('returns null when trip is null', () => {
    expect(buildMergedSavedCurrencySettings({ savedAccountingCodes: [], savedTripCurrencies: [] }, null)).toBeNull();
  });

  it('merges accounting and trip codes from trip', () => {
    const prev = {
      savedAccountingCodes: ['HKD'],
      savedTripCurrencies: ['JPY'],
    };
    const trip = {
      accountingCurrency: 'USD',
      accountingIsCustom: false,
      customAccountingCodes: ['CHF'],
      tripCurrency: 'EUR',
      tripCurrencyIsCustom: false,
      customTripCurrencyCodes: ['GBP'],
    };
    const next = buildMergedSavedCurrencySettings(prev, trip);
    expect(next.savedAccountingCodes).toContain('USD');
    expect(next.savedAccountingCodes).toContain('CHF');
    expect(next.savedTripCurrencies).toContain('EUR');
    expect(next.savedTripCurrencies).toContain('GBP');
  });
});
