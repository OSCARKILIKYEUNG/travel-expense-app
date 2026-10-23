import { describe, it, expect } from 'vitest';
import { isClassicUi, isStripeUiEnabled, parseFlag, resolveUiMode } from './features.js';

describe('stripe UI flag', () => {
  it('defaults to hidden', () => {
    expect(isStripeUiEnabled({})).toBe(false);
    expect(isStripeUiEnabled(undefined)).toBe(false);
    expect(isStripeUiEnabled({ VITE_ENABLE_STRIPE_UI: '' })).toBe(false);
    expect(parseFlag('0')).toBe(false);
    expect(parseFlag('false')).toBe(false);
  });
  it('enables on truthy values', () => {
    for (const v of ['1', 'true', 'TRUE', ' on ', 'yes']) {
      expect(isStripeUiEnabled({ VITE_ENABLE_STRIPE_UI: v })).toBe(true);
    }
  });
});

describe('UI mode flag (?ui=classic)', () => {
  it('defaults to notebook redesign when no query or env flag is set', () => {
    expect(resolveUiMode('', {})).toBe('notebook');
    expect(isClassicUi('', {})).toBe(false);
    expect(isClassicUi('?foo=bar', {})).toBe(false);
  });

  it('activates classic UI when ?ui=classic is present in search', () => {
    expect(resolveUiMode('?ui=classic', {})).toBe('classic');
    expect(isClassicUi('?ui=classic', {})).toBe(true);
    expect(isClassicUi('?ui=CLASSIC', {})).toBe(true);
    expect(isClassicUi('?tab=1&ui=classic', {})).toBe(true);
    expect(isClassicUi('ui=classic', {})).toBe(true);
  });

  it('respects VITE_UI=classic fallback unless URL explicitly selects notebook', () => {
    expect(isClassicUi('', { VITE_UI: 'classic' })).toBe(true);
    expect(isClassicUi('?ui=notebook', { VITE_UI: 'classic' })).toBe(false);
    expect(isClassicUi('?ui=redesign', { VITE_UI: 'classic' })).toBe(false);
  });
});
