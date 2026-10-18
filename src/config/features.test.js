import { describe, it, expect } from 'vitest';
import { isStripeUiEnabled, parseFlag } from './features.js';

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
