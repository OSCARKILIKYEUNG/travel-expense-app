import { describe, it, expect } from 'vitest';
import {
  FREE_RECEIPT_SCAN_LIMIT,
  buildBillingSnapshot,
  getRemainingFreeScans,
  isPaidSubscriptionStatus,
} from '../../shared/billing.js';

describe('billing helpers', () => {
  it('treats active and trialing as paid statuses', () => {
    expect(isPaidSubscriptionStatus('active')).toBe(true);
    expect(isPaidSubscriptionStatus('trialing')).toBe(true);
    expect(isPaidSubscriptionStatus('canceled')).toBe(false);
    expect(isPaidSubscriptionStatus(null)).toBe(false);
  });

  it('caps remaining free scans at zero', () => {
    expect(getRemainingFreeScans(0)).toBe(FREE_RECEIPT_SCAN_LIMIT);
    expect(getRemainingFreeScans(3)).toBe(FREE_RECEIPT_SCAN_LIMIT - 3);
    expect(getRemainingFreeScans(99)).toBe(0);
  });

  it('builds a free billing snapshot', () => {
    expect(buildBillingSnapshot({ usedReceiptScans: 2 })).toEqual({
      plan: 'free',
      subscriptionStatus: null,
      hasUnlimitedScans: false,
      freeScanLimit: FREE_RECEIPT_SCAN_LIMIT,
      usedReceiptScans: 2,
      remainingFreeScans: FREE_RECEIPT_SCAN_LIMIT - 2,
    });
  });

  it('builds a pro billing snapshot', () => {
    expect(buildBillingSnapshot({
      subscriptionStatus: 'active',
      usedReceiptScans: 7,
    })).toEqual({
      plan: 'pro',
      subscriptionStatus: 'active',
      hasUnlimitedScans: true,
      freeScanLimit: FREE_RECEIPT_SCAN_LIMIT,
      usedReceiptScans: 7,
      remainingFreeScans: null,
    });
  });
});
